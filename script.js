// ======================================
// AGENTE DE VIAJE
// Motor de conversación y conexión Make
// ======================================

// Elementos de la interfaz

const formulario = document.getElementById("formulario-chat");
const campoMensaje = document.getElementById("mensaje");
const botonEnviar = document.getElementById("boton-enviar");
const mensajes = document.getElementById("mensajes");
const zonaChat = document.getElementById("zona de chat");

// Variables de sesión

let sessionId = null;
let sessionIdMemoria = null;
let ultimoEnvio = 0;

// Estados de la aplicación

let cargando = false;

// ======================================
// GENERAR IDENTIFICADOR DE SESIÓN
// ======================================

function generarSessionId() {

    if (typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function") {

        return crypto.randomUUID();

    }

    return Date.now().toString(36) +
        Math.random().toString(36).substring(2);
}

// ======================================
// RECUPERAR O CREAR SESIÓN
// ======================================

function inicializarSesion() {

    try {

        const guardado = localStorage.getItem("agente_viaje_session");

        if (guardado) {

            sessionId = guardado;

        } else {

            sessionId = generarSessionId();

            localStorage.setItem(
                "agente_viaje_session",
                sessionId
            );

        }

    } catch (error) {

        // Si el almacenamiento no está disponible,
        // mantener la sesión en memoria.

        if (!sessionIdMemoria) {

            sessionIdMemoria = generarSessionId();

        }

        sessionId = sessionIdMemoria;

    }

}

// Crear la sesión una sola vez al iniciar

inicializarSesion();

// ======================================
// AGREGAR MENSAJES AL CHAT
// ======================================

function agregarMensaje(texto, tipo, estado = "") {

    const contenedor = document.createElement("div");

    contenedor.className = `mensaje ${tipo}`;

    if (estado) {
        contenedor.classList.add(estado);
    }

    const avatar = document.createElement("div");

    avatar.className = "avatar-mensaje";

    avatar.textContent = tipo === "agente" ? "✈" : "👤";

    const burbuja = document.createElement("div");

    burbuja.className = "burbuja";

    // Mostrar el contenido de forma segura

    burbuja.textContent = texto;

    contenedor.appendChild(avatar);
    contenedor.appendChild(burbuja);

    mensajes.appendChild(contenedor);

    // Bajar automáticamente al último mensaje

    zonaChat.scrollTop = zonaChat.scrollHeight;

    return contenedor;

}

// ======================================
// CONTROLAR ESTADOS DE LA INTERFAZ
// ======================================

function cambiarEstado(estado) {

    if (estado === "cargando") {

        campoMensaje.disabled = true;
        botonEnviar.disabled = true;

        botonEnviar.setAttribute("aria-label", "Enviando mensaje");

    } else {

        campoMensaje.disabled = false;
        botonEnviar.disabled = false;

        botonEnviar.setAttribute("aria-label", "Enviar mensaje");

    }

}

// ======================================
// ESPERAR EL TIEMPO MÍNIMO ENTRE ENVÍOS
// ======================================

function esperar(ms) {

    return new Promise(resolve => setTimeout(resolve, ms));

}

// ======================================
// EXTRAER RESPUESTA DE MAKE
// ======================================

function obtenerRespuesta(texto) {

    if (!texto.trim()) {

        return "(respuesta vacía)";

    }

    try {

        const datos = JSON.parse(texto);

        // Si Make devuelve un objeto JSON,
        // buscar el primer campo válido.

        if (datos !== null &&
            typeof datos === "object" &&
            !Array.isArray(datos)) {

            const propiedades = [
                "response",
                "respuesta",
                "message",
                "mensaje"
            ];

            for (const propiedad of propiedades) {

                const valor = datos[propiedad];

                if (
                    typeof valor === "string" &&
                    valor.trim() !== ""
                ) {

                    return valor;

                }

            }

            return "Make respondió, pero sin el campo response";

        }

        // Si es JSON válido pero no es un objeto,
        // mostrar el texto original.

        return texto;

    } catch (error) {

        // Si no es JSON, mostrar el texto original.

        return texto;

    }

}

// ======================================
// ENVIAR MENSAJE AL WEBHOOK
// ======================================

async function enviarMensaje(evento) {

    evento.preventDefault();

    // Evitar envíos repetidos

    if (cargando) return;

    // Validar configuración del webhook

    if (
        typeof WEBHOOK_URL === "undefined" ||
        !WEBHOOK_URL.trim() ||
        WEBHOOK_URL.includes("ACA VA")
    ) {

        agregarMensaje(
            "Falta pegar la URL de tu webhook en config.js",
            "agente"
        );

        return;

    }

    // Leer y validar el mensaje

    const mensaje = campoMensaje.value.trim();

    if (!mensaje) return;

    if (mensaje.length > 500) {

        agregarMensaje(
            "El mensaje no puede superar los 500 caracteres.",
            "agente"
        );

        return;

    }

    // Bloquear controles mientras se procesa

    cargando = true;

    cambiarEstado("cargando");

    // Mostrar mensaje del usuario

    agregarMensaje(mensaje, "usuario");

    // Limpiar campo

    campoMensaje.value = "";

    // Crear indicador de carga

    const indicador = agregarMensaje(
        "Estoy preparando tu respuesta...",
        "agente",
        "cargando"
    );

    let controller = null;
    let temporizador = null;

    try {

        // Pausa mínima de 1,5 segundos entre envíos

        const tiempoTranscurrido = Date.now() - ultimoEnvio;

        const tiempoEspera = Math.max(
            0,
            1500 - tiempoTranscurrido
        );

        if (tiempoEspera > 0) {

            await esperar(tiempoEspera);

        }

        // Registrar momento del envío

        ultimoEnvio = Date.now();

        // Crear controlador de cancelación

        controller = new AbortController();

        // Límite máximo de 30 segundos

        temporizador = setTimeout(() => {

            controller.abort();

        }, 30000);

        // Preparar los tres datos obligatorios

        const datos = {
            sessionId: sessionId,
            mensaje: mensaje,
            fecha: new Date().toISOString()
        };

        // Enviar solicitud a Make

        const respuesta = await fetch(WEBHOOK_URL, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(datos),

            signal: controller.signal

        });

        // Leer respuesta del servidor

        const textoRecibido = await respuesta.text();

        // Comprobar errores HTTP

        if (!respuesta.ok) {

            throw new Error(`HTTP_${respuesta.status}`);

        }

        // Interpretar respuesta

        const respuestaFinal = obtenerRespuesta(textoRecibido);

        // Quitar indicador de carga

        indicador.remove();

        // Mostrar respuesta del agente

        agregarMensaje(respuestaFinal, "agente");

    } catch (error) {

        // Quitar indicador de carga

        indicador.remove();

        // Diferenciar los tipos de errores

        if (
            error.name === "AbortError" ||
            (controller && controller.signal.aborted)
        ) {

            agregarMensaje(
                "La solicitud tardó demasiado. Se agotó el tiempo de espera de 30 segundos. Intentá nuevamente.",
                "agente"
            );

        } else if (
            error.message.startsWith("HTTP_")
        ) {

            const codigo = error.message.replace("HTTP_", "");

            agregarMensaje(
                `Make respondió con error (código ${codigo}). Revisá que tu escenario esté en Active o que hayas apretado Run once.`,
                "agente"
            );

        } else {

            agregarMensaje(
                "No pude conectarme con el servidor. Revisá tu conexión a Internet y que la URL del webhook sea correcta.",
                "agente"
            );

        }

    } finally {

        // Limpiar temporizador

        if (temporizador) {

            clearTimeout(temporizador);

        }

        // Restaurar controles siempre

        cargando = false;

        cambiarEstado("listo");

        campoMensaje.focus();

    }

}

// ======================================
// EVENTOS
// ======================================

// Enviar mediante el botón

formulario.addEventListener("submit", enviarMensaje);

// ======================================
// FIN DEL MOTOR DEL AGENTE
// ======================================
