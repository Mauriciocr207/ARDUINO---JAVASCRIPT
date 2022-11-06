const spawner = require("child_process").spawn;
//Express - Creando el servidor
const express = require("express");
const { createServer } = require("http");
const { Server } = require("socket.io");
const app = express();

// Creacion del servidor y el socket
const serverJS = createServer(app);
const ioJS = new Server(serverJS, {});

// Configuración del servidor
serverJS.listen(65000, () => {
  console.log("ServerJS running...");
});

// Envío de documento al navegador
const arrayDirName = __dirname.split("\\");
arrayDirName.pop();
const __dirName = arrayDirName.join("\\"); // directorio 'src'
arrayDirName.pop();
const __proyectName = arrayDirName.join("\\"); // directorio raiz del proyecto
(function () {
  app.use(express.static(__proyectName + "/public"));
  app.get("/", (req, res) => {
    res.sendFile(__proyectName + "/public/index.html");
  });
})();

//Procesamiento de los datos con Python
let python_processBin; // varibale donde se guardará la salida de datos a binario
let python_processString; // variable donde se guardará la entrada de datos en string
function pythonProcessToBin(input) {
  const pyDirection = __dirName + "/venv/src/toBin.py";
  const Data = {
    input,
  };
  python_processBin = spawner("python", [pyDirection, JSON.stringify(Data)]);

  python_processBin.stdout.on("data", (data) => {
    const newData = JSON.parse(data)["text__messageBinary"];
    port.write(newData);
    console.log(newData);
  });
}
function pythonProcessToString(input) {
  const pyDirection = __dirName + "/venv/src/toString.py";
  const Data = {
    input,
  };
  python_processString = spawner("python", [pyDirection, JSON.stringify(Data)]);

  python_processString.stdout.on("data", (data) => {
    const newData = JSON.parse(data);
    mensaje = newData["text__message"];
    input = newData["input"];
    ioJS.emit("arduino:data", mensaje, input);
    console.log("mensaje: ", input);
  });
}

// Conexión Serial
const { SerialPort } = require("serialport");
let port = {}; // variable global para el puerto
let message = "";
function createSerialPort(portValue) {
  // Se crea el puerto y los eventos del puerto.
  port = new SerialPort({
    path: portValue,
    baudRate: 9600,
    autoOpen: false,
  });
  console.log(`Port created on: ${port.path}`);

  //RECEPCION DE DATOS DEL ARDUINO
  // arduino -> servidor -> cliente
  port.on("data", (data) => {
    const dataString = data.toString();
    pythonProcessToString(dataString);
  });

  port.on("err", () => {
    console.log("error al abrir el puerto");
  });
}
createSerialPort("COM1"); // Se inicializa el puerto en el COM1

// Envío y recepción de datos
// Conexión de socket
ioJS.on("connection", (client) => {
  console.log("A new client conected");
  console.log("Client ID: " + client.id);
  console.log("Client IP: " + client.handshake.address);
  port.isOpen ? port.close() : null;

  // Se recibe el nombre del puerto
  client.on("port", (portValue) => {
    createSerialPort(portValue);
  });

  //Conexión del puerto
  client.on("wantOpenPort", (theWant) => {
    if (theWant) {
      port.open((err) => {
        if (err) {
          client.emit("arduinoDisconnected", true);
          console.log("CONECTA ARDUINO");
        } else {
          client.emit("openedPort", true);
          console.log("PUERTO ABIERTO");
        }
      });
    } else {
      port.close((err) => {
        if (err) {
          client.emit("arduinoDisconnected", true);
          console.log("CONECTA ARDUINO");
        } else {
          client.emit("openedPort", false);
          console.log("PUERTO CERRADO");
        }
      });
    }
  });

  //ENVIO DE DATOS AL ARDUINO
  // arduino <- servidor <- cliente
  client.on("envioDatos", (data) => {
    pythonProcessToBin(data);
  });
});
