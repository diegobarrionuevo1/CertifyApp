import express, { Request, Response } from "express";
import dotenv from "dotenv";
import path from "path";
import cors from "cors";
import fs from "fs";
import { getData } from "./getData";
import { individualData } from "./individualData";

dotenv.config();

const app = express();
const PORT= process.env.PORT || 3000;
const HOSTNAME:string = process.env.HOSTNAME||'0.0.0.0';

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
app.post("/certificadoIndividual", async (req: Request, res: Response) => {
  try {
    if (req.headers.authorization === process.env.AUTHORIZATION_CERT) {
      await individualData(req, res);
      console.log(req.body)
    } else {
      res.status(401);
      res.send("Unauthorized");
    }
  } catch (error) {
    console.error("Error:", error);
    res.status(500).send("Internal server error.");
  }
})

app.listen(PORT, () => console.log(`Certify App listening on port ${PORT}!`));