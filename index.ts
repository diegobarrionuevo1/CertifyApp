import express, { Request, Response } from "express";
import dotenv from "dotenv";
import { Persona, superponerTextoEnImagen } from "./sharp";
import path from "path";
import cors from "cors"
import fs from "fs"
import axios from "axios";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors())
app.use(express.json());


const fetchCustom = (
  url: string,
  method: string,
  body: object,
  which: string
) => {
  const requestOptions: RequestInit = {
    method: method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `${process.env.AUTHORIZATION_DIRECTUS}`,
    },
  };

  if (method !== "GET") {
    requestOptions.body = JSON.stringify(body);
  }

  return fetch(url, requestOptions)
    .then(async (response) => {
      const result = {
        ok: response.ok,
        status: response.status,
        message: response.statusText,
        json: await response.json(),
      };

      if (!response.ok) {
        throw new Error(
          "Request failed with status " +
            response.status +
            `IN ACQUISITION OF ${which}`
        );
      }
      return result;
    })
    .catch((err) => {
      throw { message: err.message, status: err.status || 500 };
    });
};
const fetchImage = async (url: string): Promise<Buffer> => {
  const requestOptions: RequestInit = {
    method: "GET",
    headers: {
      Authorization: `${process.env.AUTHORIZATION_DIRECTUS}`,
    },
  };

  const response = await fetch(url, requestOptions);

  if (!response.ok) {
    throw new Error(`fetchImage Request failed with status ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  console.log(buffer, typeof buffer);

  return buffer;
};
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


app.get("/files/jpg/:id_curso/:nombreArchivo", (req, res) => {
  if (!process.env.AUTHORIZATION_CERT) {
    console.error("AUTHORIZATION_CERT is not set in environment variables");
    res.status(500).send("Server configuration error");
    return;
  }

  if (req.headers.authorization !== process.env.AUTHORIZATION_CERT) {
    res.status(403).send("Unauthorized");
    return;
  }

  const { id_curso, nombreArchivo } = req.params;
  const filePath = path.join(__dirname, "files/jpg", id_curso, nombreArchivo);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error(`File not found at path: ${filePath}`);
      res.status(404).send('File not found');
      return;
    }

    res.status(200).sendFile(filePath);
  });
});

app.get("/files/pdf/:id_curso/:nombreArchivo", (req: Request, res: Response) => {
  try {
    if (req.headers.authorization === process.env.AUTHORIZATION_CERT) {
      const { id_curso, nombreArchivo } = req.params;
      const filePath = path.join(__dirname, "files/pdf", id_curso, nombreArchivo);

      res.status(200);
      res.sendFile(filePath);
    }else {
      res.status(403);
      res.send("Unauthorized");
    }
  } catch (error) {
    console.error(error);
    res.status(500);
    res.send("Internal server error");
  }
});
app.get("/files/rrss/:id_curso/:nombreArchivo", (req: Request, res: Response) => {
  try {
    if (req.headers.authorization === process.env.AUTHORIZATION_CERT) {
      const { id_curso, nombreArchivo } = req.params;
      const filePath = path.join(__dirname, "files/rrss", id_curso, nombreArchivo);

      res.status(200);
      res.sendFile(filePath);
    }
  } catch (error) {
    res.send("Unauthorized");
    res.status(403);
  }
});


app.post("/crearcertificado", async (req: Request, res: Response) => {
  try {
    if (req.headers.authorization === process.env.AUTHORIZATION_CERT) {
      const curso = req.body.keys[0];
      const fetchPromise = await fetchCustom(
        `https://certapps.donweb.com/items/Cursos/${curso}`,
        "GET",
        {},
        "CURSO"
      );
      if (fetchPromise.ok) {
        const idCurso = fetchPromise.json.data.id_curso;
        const tituloCurso = fetchPromise.json.data.titulo_curso
        const idPlantilla = fetchPromise.json.data.plantilla;
        let plantillaCurso: any;
        const webinars = fetchPromise.json.data.webinars;
        let registrados: Set<number|String> = new Set();
        let dataRegistrados: Array<Persona> = [];
        let conjuntoCorreos: Set<string> = new Set();
        const fetchWebinars = webinars.map(async (webinarId: number|string) => {
          const webinarsPromise = await fetchCustom(
            `https://certapps.donweb.com/items/webinar/${webinarId}`,
            "GET",
            {},
            "WEBINARS"
          );
          console.log (webinarsPromise.json)
          if (webinarsPromise.ok) {
            const registradosIds = webinarsPromise.json.data.registrados;
            registradosIds.forEach((registradoId: number|string) => {
              registrados.add(registradoId);
            });
          }
        });

        await Promise.all(fetchWebinars);

        console.log(
          "----------------------------------------------------Listo el array con registrados:",
          Array.from(registrados)
        );

        const fetchRegistrados = Array.from(registrados).map(
          async (registradoId) => {
            const registradosPromise = await fetchCustom(
              `https://certapps.donweb.com/items/registrado/${registradoId}`,
              "GET",
              {},
              "REGISTRADOS"
            );
            if (registradosPromise.ok) {
              const correo = registradosPromise.json.data.correo;
              if (!conjuntoCorreos.has(correo)) {
                conjuntoCorreos.add(correo);
                registradosPromise.json.data.urlFront = `https://certificados.donweb.com/${idCurso}/${idCurso}_${correo.toLowerCase()}`;
                dataRegistrados.push(registradosPromise.json.data);
              }
            }
          }
        );

        await Promise.all(fetchRegistrados);

        console.log(
          "----------------------------------------------------Listo el array con la data:",
          dataRegistrados
        );

        const imageUrl = `https://certapps.donweb.com/assets/${idPlantilla}`;
        try {
          plantillaCurso = await fetchImage(imageUrl);
        } catch (error) {
          console.error("Error al obtener la imagen:", error);
        }

        res.status(200);
        res.send("Authorized request");

        superponerTextoEnImagen(idCurso, plantillaCurso, dataRegistrados)
          .then(() => {
            console.log("Imágenes superpuestas creadas con éxito.");
          })
          .catch((error) => {
            console.error("Error al crear las imágenes superpuestas:", error);
          });
        
        const envialoSimple ={
          tituloCurso,
          dataRegistrados
        }
        console.log(envialoSimple)
      } else {
        res.status(500).send("Internal server error.");
      }
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
