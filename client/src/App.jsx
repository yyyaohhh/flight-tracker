import { useState, useEffect } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

function App() {
  const [currentView, setCurrentView] = useState('search') // toggles between 'search' and 'dashboard'

  // Search State
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [travelDate, setTravelDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [tripType, setTripType] = useState('one_way')
  const [flights, setFlights] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedAirline, setSelectedAirline] = useState('All')
  const [sortBy, setSortBy] = useState('cheapest')

  const [savedFlights, setSavedFlights] = useState([])

  const handleSearch = async (event) => {
    event.preventDefault()
    setLoading(true)
    setSelectedAirline('All')

    try {
      let fetchUrl = `http://127.0.0.1:5000/api/flights?origin=${origin}&destination=${destination}&date=${travelDate}&tripType=${tripType}`
      if (tripType === 'round_trip') {
        fetchUrl += `&returnDate=${returnDate}`
      }
      const response = await fetch(fetchUrl)
      const data = await response.json()
      setFlights(data)
    } catch (error) {
      console.log("error fetching flights", error)
    }
    setLoading(false)
  }

  const handleSaveFlight = async (flight) => {
    try {
      const response = await fetch('http://127.0.0.1:5000/api/save_flight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flight)
      })
      if (response.ok) {
        alert('flight saved successfully to your database')
      }
    } catch (error) {
      console.log("error saving flight", error)
    }
  }

  const loadDashboard = async () => {
    setCurrentView('dashboard')
    try {
      const response = await fetch('http://127.0.0.1:5000/api/saved_flights')
      const data = await response.json()
      setSavedFlights(data)
    } catch (error) {
      console.log("error fetching saved flights", error)
    }
  }

  const formatTime = (timeString) => {
    if (!timeString || timeString === 'Unknown') return 'Unknown Time'
    const dateObj = new Date(timeString)
    return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })
  }

  const formatShortDate = (timeString) => {
    if (!timeString || timeString === 'Unknown') return ''
    const dateObj = new Date(timeString)
    return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }

  const formatDuration = (seconds) => {
    if (!seconds) return '0h 0m'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }

  const uniqueAirlines = ['All', ...new Set(flights.map(f => f.airline))]
  let processedFlights = selectedAirline === 'All' ? flights : flights.filter(f => f.airline === selectedAirline)

  processedFlights = [...processedFlights].sort((a, b) => {
    if (sortBy === 'cheapest') return String(a.price).localeCompare(String(b.price), undefined, { numeric: true })
    if (sortBy === 'fastest') return String(a.total_time).localeCompare(String(b.total_time), undefined, { numeric: true })
    return 0
  })

  const graphData = savedFlights.map(flight => ({
    date: formatShortDate(flight.departure_time),
    price: parseFloat(flight.price),
    airline: flight.airline
  }))

  // --- STYLES ---
  const containerStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'arial', marginTop: '20px', paddingBottom: '50px', width: '100%' }
  const navStyle = { display: 'flex', gap: '20px', marginBottom: '30px' }
  const navButtonStyle = (active) => ({ padding: '10px 20px', cursor: 'pointer', fontWeight: 'bold', border: 'none', borderRadius: '5px', backgroundColor: active ? '#007bff' : '#e9ecef', color: active ? 'white' : '#333' })
  const formStyle = { display: 'flex', flexDirection: 'column', gap: '15px', padding: '30px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)', width: '300px', marginBottom: '20px' }
  const inputStyle = { padding: '10px', borderRadius: '5px', border: '1px solid #cccccc', fontSize: '16px' }
  const buttonStyle = { padding: '12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }
  const cardStyle = { border: '1px solid #dddddd', borderRadius: '8px', padding: '15px', marginBottom: '10px', width: '300px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', backgroundColor: '#f8f9fa', display: 'flex', flexDirection: 'column', gap: '8px' }
  const graphContainerStyle = { width: '90%', maxWidth: '800px', height: '400px', backgroundColor: 'white', padding: '20px', borderRadius: '10px', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)', marginBottom: '30px' }

  return (
    <div style={containerStyle}>
      <h2>flight price tracker</h2>

      <div style={navStyle}>
        <button style={navButtonStyle(currentView === 'search')} onClick={() => setCurrentView('search')}>Search Flights</button>
        <button style={navButtonStyle(currentView === 'dashboard')} onClick={loadDashboard}>My Dashboard</button>
      </div>

      {currentView === 'search' && (
        <>
          <form onSubmit={handleSearch} style={formStyle}>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
              <label><input type="radio" value="one_way" checked={tripType === 'one_way'} onChange={(e) => setTripType(e.target.value)} /> one way</label>
              <label><input type="radio" value="round_trip" checked={tripType === 'round_trip'} onChange={(e) => setTripType(e.target.value)} /> round trip</label>
            </div>
            <input type="text" placeholder="origin city" value={origin} onChange={(e) => setOrigin(e.target.value)} style={inputStyle} required />
            <input type="text" placeholder="destination city" value={destination} onChange={(e) => setDestination(e.target.value)} style={inputStyle} required />
            <input type="date" value={travelDate} onChange={(e) => setTravelDate(e.target.value)} style={inputStyle} required />
            {tripType === 'round_trip' && <input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} style={inputStyle} required />}
            <button type="submit" style={buttonStyle}>{loading ? 'searching...' : 'search flights'}</button>
          </form>

          {flights.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', width: '300px', marginBottom: '20px', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 'bold', display: 'block', fontSize: '14px', marginBottom: '4px' }}>airline</label>
                <select value={selectedAirline} onChange={(e) => setSelectedAirline(e.target.value)} style={{ ...inputStyle, width: '100%', padding: '6px' }}>
                  {uniqueAirlines.map(airline => <option key={airline} value={airline}>{airline}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontWeight: 'bold', display: 'block', fontSize: '14px', marginBottom: '4px' }}>sort by</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ ...inputStyle, width: '100%', padding: '6px' }}>
                  <option value="cheapest">cheapest</option>
                  <option value="fastest">fastest</option>
                </select>
              </div>
            </div>
          )}

          <div>
            {processedFlights.map((flight, index) => (
              <div key={index} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, color: '#333333', fontSize: '16px', flexGrow: 1 }}>{flight.airline}</h3>
                  <p style={{ margin: 0, fontSize: '18px', color: '#28a745', fontWeight: 'bold' }}>{flight.price} {flight.currency}</p>
                </div>
                <p style={{ margin: '0', fontSize: '14px', color: '#888888' }}>total duration: {formatDuration(flight.total_time)}</p>
                <div style={{ fontSize: '14px', color: '#666666', marginTop: '5px' }}>
                  <p style={{ margin: '0 0 4px 0', color: '#007bff', fontWeight: 'bold' }}>outbound</p>
                  <p style={{ margin: '0 0 4px 0' }}><strong>departs</strong> {formatTime(flight.departure)}</p>
                  <p style={{ margin: '0 0 10px 0' }}><strong>arrives</strong> {formatTime(flight.arrival)}</p>
                  {flight.is_round_trip && (
                    <div>
                      <p style={{ margin: '0 0 4px 0', color: '#007bff', fontWeight: 'bold' }}>return</p>
                      <p style={{ margin: '0 0 4px 0' }}><strong>departs</strong> {formatTime(flight.return_departure)}</p>
                      <p style={{ margin: 0 }}><strong>arrives</strong> {formatTime(flight.return_arrival)}</p>
                    </div>
                  )}
                </div>
                <button onClick={() => handleSaveFlight(flight)} style={{ padding: '8px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', fontSize: '14px', cursor: 'pointer', marginTop: '10px' }}>save flight</button>
              </div>
            ))}
          </div>
        </>
      )}

      {currentView === 'dashboard' && (
        <>
          <div style={graphContainerStyle}>
            <h3 style={{ textAlign: 'center', marginBottom: '20px', color: '#333' }}>Saved Flight Prices by Departure Date</h3>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={graphData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                <Line type="monotone" dataKey="price" stroke="#007bff" strokeWidth={3} activeDot={{ r: 8 }} />
                <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip formatter={(value, name, props) => [`${value} SGD`, props.payload.airline]} />
                <Legend />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '15px', maxWidth: '1000px' }}>
            {savedFlights.map((flight, index) => (
              <div key={index} style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, color: '#333333', fontSize: '16px', flexGrow: 1 }}>{flight.airline}</h3>
                  <p style={{ margin: 0, fontSize: '18px', color: '#28a745', fontWeight: 'bold' }}>{flight.price} {flight.currency}</p>
                </div>
                <div style={{ fontSize: '14px', color: '#666666', marginTop: '10px' }}>
                  <p style={{ margin: '0 0 4px 0' }}><strong>outbound:</strong> {formatTime(flight.departure_time)}</p>
                  {flight.is_round_trip ? <p style={{ margin: 0 }}><strong>return:</strong> {formatTime(flight.return_departure)}</p> : null}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export default App