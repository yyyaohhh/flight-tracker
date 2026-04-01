import { useState } from 'react'
import Dashboard from './Dashboard'

function App() {
  const [currentView, setCurrentView] = useState('search')

  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [travelDate, setTravelDate] = useState('')
  const [returnDate, setReturnDate] = useState('')
  const [tripType, setTripType] = useState('one_way')
  const [maxStops, setMaxStops] = useState('any')
  const [flights, setFlights] = useState([])
  const [loading, setLoading] = useState(false)
  const [selectedAirline, setSelectedAirline] = useState('All')
  const [sortBy, setSortBy] = useState('cheapest')

  const handleSearch = async (event) => {
    event.preventDefault()
    setLoading(true)
    setSelectedAirline('All')

    try {
      let fetchUrl = `http://127.0.0.1:5000/api/flights?origin=${origin}&destination=${destination}&date=${travelDate}&tripType=${tripType}&maxStops=${maxStops}`
      if (tripType === 'round_trip') {
        fetchUrl += `&returnDate=${returnDate}`
      }

      const response = await fetch(fetchUrl)

      // Safety check 1: Did the server crash?
      if (!response.ok) {
        throw new Error(`server returned status ${response.status}`)
      }

      const data = await response.json()

      // Safety check 2: Is the data actually an array of flights?
      if (Array.isArray(data)) {
        setFlights(data)
      } else {
        console.log("server did not return a list of flights:", data)
        setFlights([])
        alert("no flights found or server error occurred.")
      }

    } catch (error) {
      console.log("error fetching flights", error)
      setFlights([]) // resets the screen instead of crashing
      alert("failed to search for flights. check your server console.")
    }
    setLoading(false)
  }

  const handleSaveFlight = async (flight) => {
    try {
      const payload = {
        ...flight,
        route_name: `${origin} to ${destination}`
      }
      const response = await fetch('http://127.0.0.1:5000/api/save_flight', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (response.ok) {
        alert('flight saved successfully to your database')
      }
    } catch (error) {
      console.log("error saving flight", error)
    }
  }

  const formatTime = (timeString) => {
    if (!timeString || timeString === 'Unknown') return 'Unknown Time'
    const dateObj = new Date(timeString)
    return dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric' })
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

  const containerStyle = { display: 'flex', flexDirection: 'column', alignItems: 'center', fontFamily: 'arial', marginTop: '20px', paddingBottom: '50px', width: '100%' }
  const navStyle = { display: 'flex', gap: '20px', marginBottom: '30px' }
  const navButtonStyle = (active) => ({ padding: '10px 20px', cursor: 'pointer', fontWeight: 'bold', border: 'none', borderRadius: '5px', backgroundColor: active ? '#007bff' : '#e9ecef', color: active ? 'white' : '#333' })
  const formStyle = { display: 'flex', flexDirection: 'column', gap: '15px', padding: '30px', backgroundColor: '#ffffff', borderRadius: '10px', boxShadow: '0 4px 8px rgba(0, 0, 0, 0.1)', width: '300px', marginBottom: '20px' }
  const inputStyle = { padding: '10px', borderRadius: '5px', border: '1px solid #cccccc', fontSize: '16px' }
  const buttonStyle = { padding: '12px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '5px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer' }
  const cardStyle = { border: '1px solid #dddddd', borderRadius: '8px', padding: '15px', marginBottom: '10px', width: '300px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', backgroundColor: '#f8f9fa', display: 'flex', flexDirection: 'column', gap: '8px' }

  return (
    <div style={containerStyle}>
      <h2>flight price tracker</h2>

      <div style={navStyle}>
        <button style={navButtonStyle(currentView === 'search')} onClick={() => setCurrentView('search')}>Search Flights</button>
        <button style={navButtonStyle(currentView === 'dashboard')} onClick={() => setCurrentView('dashboard')}>My Dashboard</button>
      </div>

      {currentView === 'search' && (
        <>
          <form onSubmit={handleSearch} style={formStyle}>
            <div style={{ display: 'flex', gap: '15px', marginBottom: '10px' }}>
              <label><input type="radio" value="one_way" checked={tripType === 'one_way'} onChange={(e) => setTripType(e.target.value)} /> one way</label>
              <label><input type="radio" value="round_trip" checked={tripType === 'round_trip'} onChange={(e) => setTripType(e.target.value)} /> round trip</label>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '14px', fontWeight: 'bold', color: '#555' }}>Maximum Transfers</label>
              <select
                value={maxStops}
                onChange={(e) => setMaxStops(e.target.value)}
                style={inputStyle}
              >
                <option value="any">Any number of stops</option>
                <option value="0">Direct flights only (0 stops)</option>
                <option value="1">Up to 1 stop</option>
                <option value="2">Up to 2 stops</option>
              </select>
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
                  <p style={{ margin: '0 0 4px 0', color: '#007bff', fontWeight: 'bold' }}>
                    outbound <span style={{ color: '#888', fontWeight: 'normal', fontSize: '12px' }}>({flight.flight_number})</span>
                  </p>
                  <p style={{ margin: '0 0 4px 0' }}><strong>departs</strong> {formatTime(flight.departure)}</p>
                  <p style={{ margin: '0 0 4px 0' }}><strong>arrives</strong> {formatTime(flight.arrival)}</p>

                  {/* Outbound Transfers Logic */}
                  {flight.outbound_transfers && flight.outbound_transfers.length > 0 && (
                    <div style={{ paddingLeft: '10px', borderLeft: '2px solid #ccc', margin: '8px 0 15px 5px' }}>
                      {flight.outbound_transfers.map((t, idx) => (
                        <p key={idx} style={{ margin: '2px 0', fontSize: '12px', color: '#d9534f' }}>
                          ↳ Transfer in <strong>{t.city}</strong>: {t.airline} ({t.flight_number})
                        </p>
                      ))}
                    </div>
                  )}

                  {flight.is_round_trip && (
                    <div style={{ marginTop: '15px' }}>
                      <p style={{ margin: '0 0 4px 0', color: '#007bff', fontWeight: 'bold' }}>
                        return <span style={{ color: '#888', fontWeight: 'normal', fontSize: '12px' }}>({flight.return_flight_number})</span>
                      </p>
                      <p style={{ margin: '0 0 4px 0' }}><strong>departs</strong> {formatTime(flight.return_departure)}</p>
                      <p style={{ margin: '0 0 4px 0' }}><strong>arrives</strong> {formatTime(flight.return_arrival)}</p>

                      {/* Inbound Transfers Logic */}
                      {flight.inbound_transfers && flight.inbound_transfers.length > 0 && (
                        <div style={{ paddingLeft: '10px', borderLeft: '2px solid #ccc', margin: '8px 0 5px 5px' }}>
                          {flight.inbound_transfers.map((t, idx) => (
                            <p key={idx} style={{ margin: '2px 0', fontSize: '12px', color: '#d9534f' }}>
                              ↳ Transfer in <strong>{t.city}</strong>: {t.airline} ({t.flight_number})
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button onClick={() => handleSaveFlight(flight)} style={{ padding: '8px', backgroundColor: '#28a745', color: 'white', border: 'none', borderRadius: '5px', fontSize: '14px', cursor: 'pointer', marginTop: '10px' }}>save flight</button>
              </div>
            ))}
          </div>
        </>
      )}

      {currentView === 'dashboard' && <Dashboard />}
    </div>
  )
}

export default App