import { Request, Response } from "express";
import { Persona, superponerTextoEnImagen } from "./sharp";
import { sendEmail } from "./envialoSimple";

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

export const getData = async (req: Request, res: Response) => {
  const curso = req.body.keys[0];
  const fetchPromise = await fetchCustom(
    `https://certapps.donweb.com/items/Cursos/${curso}`,
    "GET",
    {},
    "CURSO"
  );
  if (fetchPromise.ok) {
    const { id_curso, titulo_curso, plantilla, webinars } = fetchPromise.json.data
    let plantillaCurso: any;
    let registrados: Set<number | String> = new Set();
    let dataRegistrados: Array<Persona> = [];
    let conjuntoCorreos: Set<string> = new Set();
    const fetchWebinars = webinars.map(async (webinarId: number | string) => {
      const webinarsPromise = await fetchCustom(
        `https://certapps.donweb.com/items/webinar/${webinarId}`,
        "GET",
        {},
        "WEBINARS"
      );
      console.log(webinarsPromise.json);
      if (webinarsPromise.ok) {
        const registradosIds = webinarsPromise.json.data.registrados;
        registradosIds.forEach((registradoId: number | string) => {
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
            registradosPromise.json.data.urlFront = `https://certificados.donweb.com/${id_curso}/${id_curso}_${correo.toLowerCase()}`;
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

    const imageUrl = `https://certapps.donweb.com/assets/${plantilla}`;
    try {
      plantillaCurso = await fetchImage(imageUrl);
    } catch (error) {
      console.error("Error al obtener la imagen:", error);
    }

    res.status(200);
    res.send("Authorized request");

    superponerTextoEnImagen(id_curso, plantillaCurso, dataRegistrados)
      .then(() => {
        console.log("Imágenes superpuestas creadas con éxito.");
      })
      .catch((error) => {
        console.error("Error al crear las imágenes superpuestas:", error);
      });
      try {
        const envialoSimple = await sendEmail({tituloCurso: titulo_curso,
          dataRegistrados,
        })   
      } catch (error) {
        console.log(error)
      }
  } else {
    res.status(500).send("Internal server error.");
  }
};