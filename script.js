// Motor del chatbot Agente de Viaje

const mensajes = document.getElementById("mensajes");
const entrada = document.getElementById("entrada-datos");
const zonaChat = document.getElementById("zona-chat");

let arbol = {};
let nombreUsuario = "";
let nodoActual = null;
let finalizado = false;

// Cargar el árbol de decisiones desde el archivo JSON

async function cargarArbol() {
    try {
        const respuesta = await fetch("arbol_decision.json");

        if (!respuesta.ok) {
            throw new Error("No se pudo cargar el archivo");
        }

        arbol = await respuesta.json();

        // Comprobar que los nodos y sus conexiones sean válidos
        validarArbol();

        mostrarNodo("inicio");

    } catch (error) {
        mensajes.innerHTML = "";

        const aviso = document.createElement("p");
        aviso.className = "error";
        aviso.textContent =
            "Abrí el proyecto con Live Server o un servidor local para que pueda leer arbol_decision.json";

        mensajes.appendChild(aviso);
    }
}

// Comprobar que todos los destinos existan

function validarArbol() {
    if (!arbol.nodos || !arbol.nodos.length) {
        throw new Error("Árbol vacío");
    }

    const ids = new Set(arbol.nodos.map(nodo => nodo.id));

    arbol.nodos.forEach(nodo => {
        if (!nodo.id || typeof nodo.texto !== "string" ||
            !Array.isArray(nodo.opciones)) {
            throw new Error("Nodo inválido");
        }

        nodo.opciones.forEach(opcion => {
            if (!opcion.texto || !ids.has(opcion.siguiente)) {
                throw new Error("Conexión inválida");
            }
        });
    });
}

// Buscar un nodo por su identificador

function buscarNodo(id) {
    return arbol.nodos.find(nodo => nodo.id === id);
}

// Agregar un mensaje al chat

function agregarMensaje(texto, tipo) {
    const mensaje = document.createElement("div");
    mensaje.className = `mensaje ${tipo}`;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    avatar.textContent = tipo === "bot" ? "✈️" : "👤";

    const burbuja = document.createElement("div");
    burbuja.className = "burbuja";

    // Insertar texto de forma segura
    burbuja.textContent = texto;

    mensaje.appendChild(avatar);
    mensaje.appendChild(burbuja);

    mensajes.appendChild(mensaje);

    zonaChat.scrollTop = zonaChat.scrollHeight;
}

// Mostrar un nodo del árbol

function mostrarNodo(id) {
    if (finalizado) return;

    const nodo = buscarNodo(id);

    if (!nodo) return;

    nodoActual = nodo;

    entrada.innerHTML = "";

    // Reemplazar el nombre cuando corresponda
    const texto = nodo.texto.replace(
        /\{nombre\}/g,
        nombreUsuario
    );

    agregarMensaje(texto, "bot");

    // Crear opciones dinámicamente
    if (nodo.opciones.length > 0) {

        const contenedorOpciones = document.createElement("div");
        contenedorOpciones.className = "opciones";

        nodo.opciones.forEach(opcion => {

            const boton = document.createElement("button");

            boton.className = "opcion";
            boton.textContent = opcion.texto;
            boton.type = "button";

            boton.addEventListener("click", () => {

                if (finalizado) return;

                agregarMensaje(opcion.texto, "usuario");

                // Controlar el ingreso del nombre
                if (nodo.campo === "nombre") {

                    const campo = document.getElementById("campo-nombre");

                    if (!campo) return;

                    const nombre = campo.value.trim();

                    // Validación del formato del nombre
                    const formatoValido =
                        /^[\p{L}][\p{L}\s'-]{0,39}$/u;

                    if (!formatoValido.test(nombre)) {
                        mostrarError();
                        return;
                    }

                    nombreUsuario = nombre;
                }

                // Control de finalización
                if (nodoActual.id === "finalizar") {
                    finalizado = true;
                }

                if (opcion.siguiente === "inicio") {
                    reiniciarConversacion();
                } else {
                    mostrarNodo(opcion.siguiente);
                }
            });

            contenedorOpciones.appendChild(boton);
        });

        mensajes.appendChild(contenedorOpciones);
    }

    // Mostrar el campo de ingreso únicamente cuando se solicita un dato
    if (nodo.campo === "nombre") {
        mostrarCampoNombre(nodo);
    }

    // Mantener visible la zona inferior del chat
    zonaChat.scrollTop = zonaChat.scrollHeight;
}

// Mostrar el campo de ingreso de nombre

function mostrarCampoNombre(nodo) {

    const campo = document.createElement("input");

    campo.type = "text";
    campo.id = "campo-nombre";
    campo.className = "campo-nombre";
    campo.placeholder = nodo.placeholder;
    campo.maxLength = 40;
    campo.autocomplete = "given-name";
    campo.setAttribute("aria-label", nodo.placeholder);

    campo.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter") {
            const boton = mensajes.querySelector(".opciones button");
            if (boton) boton.click();
        }
    });

    entrada.appendChild(campo);

    campo.focus();
}

// Mostrar error de validación

function mostrarError() {

    const anterior = entrada.querySelector(".error");

    if (anterior) anterior.remove();

    const error = document.createElement("p");
    error.className = "error";
    error.textContent = buscarNodo("inicio").error;

    entrada.appendChild(error);
}

// Reiniciar la conversación por decisión del usuario

function reiniciarConversacion() {

    nombreUsuario = "";
    nodoActual = null;
    finalizado = false;

    mensajes.innerHTML = "";
    entrada.innerHTML = "";

    mostrarNodo("inicio");
}

// Iniciar el chatbot

cargarArbol();
