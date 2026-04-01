import React, { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export default function Dashboard() {
    const [chartData, setChartData] = useState({})
    const [routeAirlines, setRouteAirlines] = useState({})
    const [graphMeta, setGraphMeta] = useState({}) // remembers the raw database values for deletion

    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#0088fe', '#00c49f', '#e60049', '#0bb4ff']

    useEffect(() => {
        fetch('http://127.0.0.1:5000/api/saved_flights')
            .then(res => res.json())
            .then(data => {
                const groupedByGraph = {}
                const airlinesPerGraph = {}
                const meta = {}

                data.forEach(flight => {
                    const route = flight.route_name || 'Unknown Route'
                    const tripType = flight.is_round_trip ? 'Round Trip' : 'One Way'

                    const travelDateObj = new Date(flight.departure_time)
                    const travelDate = travelDateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

                    const graphTitle = `${route} (${tripType}) departing ${travelDate}`

                    const addedDateObj = new Date(flight.date_added || new Date())
                    const trackedDate = addedDateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })

                    if (!groupedByGraph[graphTitle]) {
                        groupedByGraph[graphTitle] = {}
                        airlinesPerGraph[graphTitle] = new Set()

                        // save the exact raw data so the python backend knows what to delete
                        meta[graphTitle] = {
                            route_name: route,
                            is_round_trip: flight.is_round_trip,
                            departure_time: flight.departure_time
                        }
                    }

                    if (!groupedByGraph[graphTitle][trackedDate]) {
                        groupedByGraph[graphTitle][trackedDate] = { date: trackedDate }
                    }

                    groupedByGraph[graphTitle][trackedDate][flight.airline] = flight.price
                    airlinesPerGraph[graphTitle].add(flight.airline)
                })

                const finalChartData = {}
                const finalAirlines = {}

                Object.keys(groupedByGraph).forEach(title => {
                    finalChartData[title] = Object.values(groupedByGraph[title])
                    finalAirlines[title] = Array.from(airlinesPerGraph[title])
                })

                setChartData(finalChartData)
                setRouteAirlines(finalAirlines)
                setGraphMeta(meta)
            })
            .catch(error => console.log("error loading graphs", error))
    }, [])

    const handleDeleteGraph = async (title) => {
        // browser safety check so you do not accidentally click it
        const confirmDelete = window.confirm(`are you sure you want to permanently delete tracking data for ${title}?`)
        if (!confirmDelete) return

        const targetData = graphMeta[title]

        try {
            const response = await fetch('http://127.0.0.1:5000/api/delete_graph', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(targetData)
            })

            if (response.ok) {
                // if python says it worked, instantly remove it from the react screen
                setChartData(prev => {
                    const newData = { ...prev }
                    delete newData[title]
                    return newData
                })
            } else {
                alert("failed to delete from database")
            }
        } catch (error) {
            console.log("error deleting graph", error)
        }
    }

    return (
        <div style={{ padding: '20px' }}>
            <h2>Flight Price Trends</h2>
            {Object.keys(chartData).map((title, index) => (
                <div key={index} style={{ marginBottom: '50px', backgroundColor: '#f9f9f9', padding: '20px', borderRadius: '10px' }}>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, color: '#333' }}>{title}</h3>
                        <button
                            onClick={() => handleDeleteGraph(title)}
                            style={{ padding: '8px 15px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                            Delete Route
                        </button>
                    </div>

                    <div style={{ width: '100%', height: '400px' }}>
                        <ResponsiveContainer>
                            <LineChart data={chartData[title]}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                {routeAirlines[title].map((airline, i) => (
                                    <Line
                                        key={i}
                                        type="monotone"
                                        dataKey={airline}
                                        stroke={colors[i % colors.length]}
                                        strokeWidth={2}
                                        connectNulls={true}
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            ))}
        </div>
    )
}