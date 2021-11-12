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
import util from 'util'

const STATS_INDEX_NAME = 'stats'
const STATE_INDEX_NAME = 'state'

class StatsStore {
    private _elasticSearchClient: Client
    
    constructor() {
        this._elasticSearchClient = new Client({
            cloud: {
                id: process.env.ES_ID
            },
            auth: {
                username: process.env.ES_USER,
                password: process.env.ES_PASS
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
            const stateExistsResponse = await this._elasticSearchClient.indices.exists({
                index: STATE_INDEX_NAME
            })

            if (stateExistsResponse.body != true) {
                await this._elasticSearchClient.indices.create({
                    index: STATE_INDEX_NAME,
                    body: settings
                })
            }
        }
        catch(err) {
            console.debug(`Creating state index failed: ${err}`)
        }

        try {
            this.createStatsDataStream()
        }
        catch(err) {
            console.debug(`Creating stats data stream failed: ${err}`)
        }
    }

    public addStatsEntry = async ( deviceId: string, document: ClientLogPayloads.PeerStats ) => { 
        try {
            const peerConnection = document.stats as any

            await this._elasticSearchClient.index({
                index: `stats-datastream-${document.deviceId}-${document.targetDeviceId}`,
                body: {
                    '@timestamp': peerConnection.RTCPeerConnection.timestamp,
                    stats: document
                }
            })
        } catch (err) {
            console.error(`Adding a document to stats index failed: ${err}`)
        }
    }

    public addStateEntry = async ( event: string, document: ClientLogPayloads.PeerConnecting | ClientLogPayloads.PeerConnected 
        | ClientLogPayloads.PeerDisconnected | ClientLogPayloads.PeerIceFailed ) => {
        try {
            this.updateEmail(document.deviceId)
            const targetEmail = await this.getEmail(document.targetDeviceId)

            this._elasticSearchClient.index({
                id: `${document.deviceId}-${document.targetDeviceId}`,
                index: STATE_INDEX_NAME,
                body: { ...document, targetEmail: targetEmail, event: event }
            })
        } catch (err) {
            console.error(`Adding a document to state index failed: ${err}`)
        }
    }

    public clear = async () => {
        try {
            await this._elasticSearchClient.indices.delete({
                index: [STATE_INDEX_NAME]
            })
        }
        catch(err) {
            console.log(`state index delete failed: ${err}`)
        }
        
        try {
            this.clearStatsDataStream()
        } catch (err) {
            console.log(`Clear failed: ${err}`)
        }

        try {
            this.init()
        } catch (err) {
            console.log(`Clear failed: ${err}`)
        }
    }

    private updateEmail = async (deviceId: string) => {
        const { body } = await this._elasticSearchClient.search({
            index: 'state',
            body: {
              query: {
                match: {
                  targetDeviceId: deviceId
                }
              }
            }
          })

        if (body.hits.total.value != 0) {
            body.hits.hits.forEach(async (hit) => {
                try {
                    await this._elasticSearchClient.update({
                        index: 'state',
                        id: hit._id,
                        body: {
                            script: {
                                lang: 'painless',
                                source: `ctx._source.targetEmail = "${hit._source.email}"`
                            }
                        }
                    })
                }
                catch(err) {
                    // Skip. Most probably it's a version conflict when we update the same document multiple times due to multiple stats coming at once. 
                }
            })
        }
    }

    private getEmail = async (targetDeviceId: string) => {
        const { body } = await this._elasticSearchClient.search({
            index: 'state',
            body: {
              query: {
                match: {
                  deviceId: targetDeviceId
                }
              }
            }
          })

        return body.hits.hits[0] ? body.hits.hits[0].email : ''
    }

    private clearStatsDataStream = async () => {
        try {
            await this._elasticSearchClient.indices.deleteDataStream({
                name: 'stats-datastream'
            })
        }
        catch(err) {
            console.log(`Cannot delete data stream: ${err}`)
        }

        try {
            await this._elasticSearchClient.indices.deleteIndexTemplate({
                name: 'index-template-stats'
            })
        }
        catch(err) {
            console.log(`Cannot delete index template: ${err}`)
        }

        try {
            await this._elasticSearchClient.cluster.deleteComponentTemplate({
                name: 'mappings-stats'
            })
        }
        catch(err) {
            console.log(`Cannot delete component template: ${err}`)
        }

        try {
            await this._elasticSearchClient.ilm.deleteLifecycle({
                policy: 'statsPolicy'
            })
        }
        catch(err) {
            console.log(`Cannot delete component template: ${err}`)
        }
    }

    private createStatsDataStream = async () => {
        try {
            await this._elasticSearchClient.cluster.putComponentTemplate({
                name: 'mappings-stats',
                create: true,
                body: {
                    'template': {
                        'mappings': {
                            'properties': {
                                '@timestamp': {
                                    'type': 'date',
                                    'format': 'date_optional_time||epoch_millis'
                                },
                                'message': {
                                    'type': 'object'
                                }
                            }
                        }
                    },
                    '_meta': {
                        'description': 'Mappings for @timestamp in stats'
                    }
                }
            })
        }
        catch(err) {
            console.debug(`Cannot create component template ${err}`)
        }

        try {
            await this._elasticSearchClient.indices.putIndexTemplate({
                name: 'index-template-stats',
                create: true,
                body: {
                    'index_patterns': 'stats-*',
                    'data_stream': {},
                    'composed_of': ['mappings-stats'],
                    'priority': 500,
                    '_meta': {
                        'description': 'Template for stats'
                    }
                }
            })
        }
        catch(err) {
            // console.debug(`Cannot create index template ${err}`)
        }

        try {
            await this._elasticSearchClient.indices.createDataStream({
                name: 'stats-datastream'
            })
        }
        catch(err) {
            // console.debug(`Cannot create data stream ${err}`)
        }
    }
}

export { StatsStore }