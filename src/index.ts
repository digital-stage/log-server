/*
 * Copyright (c) 2021 Digital Stage
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import express from 'express'
import { ClientLogEvents, ClientLogPayloads } from '@digitalstage/api-types'
import { StatsStore } from '../StatsStore/StatsStore'
import { exit } from 'process'
import dotenv from 'dotenv'
import cors from 'cors'

dotenv.config()

const init = async () => {
    const app = express()
    const port = 3001
    
    app.use(express.text())
    app.use(cors({ origin: true }))

    let stats = new StatsStore()
    stats.init()

    process.on('SIGINT', async () => {
        await stats.clear()
        exit()
    })

    app.post(`/${ClientLogEvents.RTCSignalingStateChanged}`, async (req, reply) => {
        const payload = JSON.parse(req.body as string) as ClientLogPayloads.RTCSignalingStateChanged
        console.log(`${payload.email}'s device ${payload.deviceId} with ${payload.targetDeviceId} RTC signaling state changed to ${payload.state}`)

        await stats.onRTCSignalingStateChange(payload)

        return reply.status(200)
    })

    app.post(`/${ClientLogEvents.RTCIceConnectionStateChanged}`, async (req, reply) => {
        const payload = JSON.parse(req.body as string) as ClientLogPayloads.RTCIceConnectionStateChanged
        console.log(`${payload.email}'s device ${payload.deviceId} with ${payload.targetDeviceId} RTC ICE connection state changed to ${payload.state}`)

        await stats.onRTCIceConnectionStateChange(payload)

        return reply.status(200)
    })

    app.post(`/${ClientLogEvents.RTCPeerConnectionStateChanged}`, async (req, reply) => {
        const payload = JSON.parse(req.body as string) as ClientLogPayloads.RTCPeerConnectionStateChanged
        console.log(`${payload.email}'s device ${payload.deviceId} with ${payload.targetDeviceId} RTC peer connection state changed to ${payload.state}`)

        await stats.onRTCPeerConnectionStateChange(payload)

        return reply.status(200)
    })

    app.post(`/${ClientLogEvents.IceCandidateError}`, async (req, reply) => {
        const payload = JSON.parse(req.body as string) as ClientLogPayloads.IceCandidateError
        console.log(`${payload.email}'s device ${payload.deviceId} failed to process ICE with another user's device ${payload.targetDeviceId}, reason: ${payload.error}`)

        await stats.onIceCandidateError(payload)

        return reply.status(200)
    })

    app.post(`/${ClientLogEvents.PeerStats}`, async (req, reply) => {
        const payload = JSON.parse(req.body as string) as ClientLogPayloads.PeerStats

        console.log(`${payload.email}'s device ${payload.deviceId} has a connection to another user's device ${payload.targetDeviceId} and send some interessting statistics.`)

        await stats.addStatsEntry(payload.deviceId, payload)

        return reply.status(200)
    })

    app.post('/clear', async (req, reply) => {
        await stats.clear()

        return reply.status(200)
    })

    app.listen(port, () => console.log(`Log server - listening at http://localhost:${port}`));
}

init()
