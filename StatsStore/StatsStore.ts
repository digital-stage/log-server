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

import { Client } from '@elastic/elasticsearch'
import { ClientLogEvents, ClientLogPayloads } from '@digitalstage/api-types'

const OPEN_SEARCH_URI = 'http://localhost:9200'

const STATS_INDEX_NAME = 'stats'
const STATE_INDEX_NAME = 'state'

class StatsStore {
    private _elasticSearchClient: Client
    
    constructor() {
        this._elasticSearchClient = new Client({
            node: OPEN_SEARCH_URI,
            ssl: {
                rejectUnauthorized: false
            }
        })
    }

    public init = async () => {
        const settings = {
            'settings': {
                'index': {
                    'number_of_shards': 1,
                    'number_of_replicas': 0
                }
            }
        }

        try {
            await this._elasticSearchClient.indices.create({
                index: STATS_INDEX_NAME,
                body: settings
            })

            await this._elasticSearchClient.indices.create({
                index: STATE_INDEX_NAME,
                body: settings
            })
        }
        catch(err) {
            console.debug(`Creating index failed: ${err}`)
        }
    }

    public addReadyState = async ( document: ClientLogPayloads.Ready ) => {
        try {
            let response = await this._elasticSearchClient.index({
                id: document.deviceId,
                index: STATE_INDEX_NAME,
                body: { ...document, 'event': ClientLogEvents.Ready }
            })
        } catch (err) {
            console.error(`Adding a document to stats index failed: ${err}`)
        }
    }

    public addStatsEntry = async ( deviceId: string, document: ClientLogPayloads.PeerStats ) => { 
        try {
            let responseStats = await this._elasticSearchClient.index({
                id: `${document.deviceId}-${document.targetDeviceId}`,
                index: STATS_INDEX_NAME,
                body: document
            })
        } catch (err) {
            console.error(`Adding a document to stats index failed: ${err}`)
        }
    }

    public addStateEntry = async ( event: string, document: ClientLogPayloads.PeerConnecting | ClientLogPayloads.PeerConnected 
        | ClientLogPayloads.PeerDisconnected | ClientLogPayloads.PeerIceFailed ) => {
        try {
            let response = await this._elasticSearchClient.index({
                id: `${document.deviceId}-${document.targetDeviceId}`,
                index: STATE_INDEX_NAME,
                body: { ...document, event: event }
            })

            console.debug(`Received Response for adding document to state index: ${response.body}`)
        } catch (err) {
            console.error(`Adding a document to state index failed: ${err}`)
        }
    }

    public clear = async () => {
        try {
            let response = await this._elasticSearchClient.indices.delete({
                index: [STATS_INDEX_NAME, STATE_INDEX_NAME]
            })
        } catch (err) {
            console.log(`Clear failed: ${err}`)
        }
    }

}


export { StatsStore }