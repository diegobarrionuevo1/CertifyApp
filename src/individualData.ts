import { Request, Response } from "express";
import { Persona, superponerTextoEnImagen } from "./sharp";
import { funcionParaEnviarEmail } from "./envialoSimple";

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

export const individualData = async (req: Request, res: Response) => {
  const individualRegistrant = req.body.keys[0];

  const fetchPromise = await fetchCustom(
    `https://certapps.donweb.com/items/registrado/${individualRegistrant}`,
    "GET",
    {},
    "Registrado"
  );
  console.log(fetchPromise);

  if (fetchPromise.ok) {
    const { id_webinar } = fetchPromise.json.data;
    let plantillaCurso: any;
    
    
    const webinarsPromise = await fetchCustom(
      `https://certapps.donweb.com/items/webinar/${id_webinar}`,
      "GET",
      {},
      "WEBINAR individual"
    );
    console.log(webinarsPromise.json.data);
    
    const { id_curso } = webinarsPromise.json.data;
    console.log(id_curso);
    
    const cursoPromise = await fetchCustom(
      `https://certapps.donweb.com/items/Cursos/${id_curso}`,
      "GET",
      {},
      "CURSO aca"
    );
    if (cursoPromise.ok) {
      const { id_curso, titulo_curso, fecha_inicio, plantilla } = cursoPromise.json.data;
      const imageUrl = `https://certapps.donweb.com/assets/${plantilla}`;
      try {
        plantillaCurso = await fetchImage(imageUrl);
      } catch (error) {
        console.error("Error al obtener la imagen:", error);
      }

      res.status(200);
      res.send("Authorized request");
      
      //let correo = fetchPromise.json.data.correo
      fetchPromise.json.data.id_curso = id_curso//`https://certificados.donweb.com/${id_curso}/${id_curso}_${correo.toLowerCase()}`
      let persona:Persona[] = [fetchPromise.json.data];
    
      superponerTextoEnImagen(id_curso, plantillaCurso, persona)
        .then(() => {
          console.log("Imágenes superpuestas creadas con éxito.");
        })
        .catch((error) => {
          console.error("Error al crear las imágenes superpuestas:", error);
        });

      console.log(
        "---------------------------------------------------------------------------------------------"
      );
      console.log(titulo_curso);
      console.log(persona);

      try {
        const envialoSimple = await funcionParaEnviarEmail(
          persona,
          titulo_curso,
          fecha_inicio,
          process.env.API_KEY
        );
      } catch (error) {
        console.log(error);
      }
    } else {
      res.status(500).send("Internal server error.");
    }
  }
};
