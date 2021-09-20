import fastify from "fastify";
import cors from "fastify-cors"
import {ClientLogEvents, ClientLogPayloads} from "@digitalstage/api-types";

const app = fastify();
app.register(cors, {
    origin: true
})

app.post(`/${ClientLogEvents.PeerConnecting}`,
    async (req, reply) => {
        const payload = JSON.parse(req.body as string) as ClientLogPayloads.PeerConnecting
        console.log(`${payload.email}'s device ${payload.deviceId} connecting to another user's device ${payload.targetDeviceId} ...`)
        return reply.status(200)
    }
)

app.post(`/${ClientLogEvents.PeerConnected}`,
    async (req, reply) => {
        const payload = req.body as ClientLogPayloads.PeerConnected
        console.log(`${payload.email}'s device ${payload.deviceId} connected with another user's device ${payload.targetDeviceId}`)
        return reply.status(200)
    }
)

app.post(`/${ClientLogEvents.PeerDisconnected}`,
    async (req, reply) => {
        const payload = JSON.parse(req.body as string) as ClientLogPayloads.PeerDisconnected
        console.log(`${payload.email}'s device ${payload.deviceId} disconnected from another user's device ${payload.targetDeviceId}`)
        return reply.status(200)
    }
)

app.post(`/${ClientLogEvents.PeerIceFailed}`,
    async (req, reply) => {
        const payload = JSON.parse(req.body as string) as ClientLogPayloads.PeerIceFailed
        console.log(`${payload.email}'s device ${payload.deviceId} failed to process ICE with another user's device ${payload.targetDeviceId}, reason: ${payload.reason}`)
        return reply.status(200)
    }
)


app.post(`/${ClientLogEvents.PeerStats}`,
    async (req, reply) => {
        const payload = JSON.parse(req.body as string) as ClientLogPayloads.PeerStats
        console.log(`${payload.email}'s device ${payload.deviceId} has a connection to another user's device ${payload.targetDeviceId} and send some interessting statistics:`)
        console.log(payload)
        return reply.status(200)
    }
)

app.listen(3001).then(() => {
    console.log('Server running at http://localhost:3001/')
})