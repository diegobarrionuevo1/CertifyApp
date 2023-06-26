import express, { Request, Response } from "express";
import dotenv from "dotenv";
import path from "path";
import axios from "axios";
import cors from "cors";
import fs from "fs";
import { getData } from "./getData";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());


const getFile = (req: Request, res: Response, fileType: string)=> {
  try {
    if (req.headers.authorization === process.env.AUTHORIZATION_CERT) {
      res.status(200);
      const { id_curso, nombreArchivo } = req.params;
      const filePath = path.join(__dirname, `files/${fileType}`, id_curso, nombreArchivo);

      if (!fs.existsSync(filePath)) {
        res.status(404).send("File not found");
        return;
      }
      res.sendFile(filePath);
    } else {
      res.status(403);
      res.send("Unauthorized");
    }
  } catch (error) {
    res.send("internal error: " + error);
    res.status(500);
  }
}
//ian envialo simple
const SMTP_EMAIL = process.env.SMTP_EMAIL
const SMTP_URL = process.env.SMTP_URL
const API_KEY = process.env.API_KEY
const MAX_RETRIES = 3

async function sendEmail(emailData: { email: any; data: any; }, retryCount = 0) {
  const { email, data } = emailData
  const requestData = {
    from: SMTP_EMAIL,
    to: email,
    templateID: "643851c86fe769a160054def",
    subject: "Felicitaciones por completar el taller",
    substitutions: data.reduce((acc: { [x: string]: any; }, item: { key: string | number; value: any; }) => {
      acc[item.key] = item.value
      return acc
    }, {}),
  }
  if (!SMTP_URL) {
  throw new Error('SMTP_URL is not defined');
  }
  try {
    await axios.post(SMTP_URL, requestData, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
    })
  } catch (e) {
    console.log("Error when sending email: ")
    if (retryCount < MAX_RETRIES) {
      console.log(`Retry attempt ${retryCount + 1} for ${email}`)
      await sendEmail(emailData, retryCount + 1)
    } else {
      console.log(
        `Failed to send email to ${email} after ${MAX_RETRIES} retries`
      )
    }
  }
}
app.post("/send-emails", async (req, res) => {
  try {
    const { usuarios: users } = req.body
    if (users?.length === 0) {
      return res.status(400).json({ error: "No users provided" })
    }

    const sendEmails = users?.map((user: any) => sendEmail(user))

    await Promise.all(sendEmails)
    res.json({ success: true })
  } catch (error) {
    console.error("Error sending emails:", error)
    return res
      .status(500)
      .json({ error: "An error occurred while sending emails" })
  }
})



app.get(
  "/files/jpg/:id_curso/:nombreArchivo",
  (req: Request, res: Response) => {
    getFile(req, res, "jpg");
  }
);
app.get(
  "/files/pdf/:id_curso/:nombreArchivo",
  (req: Request, res: Response) => {
    getFile(req, res, "pdf");
  }
);
app.get(
  "/files/rrss/:id_curso/:nombreArchivo",
  (req: Request, res: Response) => {
    getFile(req, res, "rrss");
  }
);
app.get(
  "/files/email/:id_curso/:nombreArchivo",
  (req: Request, res: Response) => {
    getFile(req, res, "email")
  }
);

app.post("/crearcertificado", async (req: Request, res: Response) => {
  try {
    if (req.headers.authorization === process.env.AUTHORIZATION_CERT) {
      await getData(req, res);
    } else {
      res.status(401);
      res.send("Unauthorized");
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal server error.");
  }
});

app.listen(port, () => console.log(`Certify App listening on port ${port}!`));
