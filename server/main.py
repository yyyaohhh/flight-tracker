from flask import Flask, jsonify, request
import requests
import pymysql
import os
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)

@app.after_request
def add_cors_headers(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

api_key = os.getenv("RAPIDAPI_KEY")
api_host = "booking\x2dcom15.p.rapidapi.com"
headers_dict = {
    "x\x2drapidapi\x2dkey": api_key,
    "x\x2drapidapi\x2dhost": api_host
}

def get_db_connection():
    return pymysql.connect(
        host='localhost',
        user='root',
        password=os.getenv("DB_PASSWORD"),
        database='flight_tracker',
        cursorclass=pymysql.cursors.DictCursor
    )

def get_location_id(city_name):
    url = f"https://{api_host}/api/v1/flights/searchDestination"
    querystring = {"query": city_name}
    
    try:
        response = requests.get(url, headers=headers_dict, params=querystring)
        data = response.json()
        
        if data.get('status') and data.get('data'):
            return data['data'][0].get('id')
    except Exception as e:
        print("error finding location", e)
        
    return None

@app.route('/api/flights')
def get_flights():
    user_origin = request.args.get('origin', 'Singapore')
    user_dest = request.args.get('destination', 'Shanghai')
    user_date = request.args.get('date', '2026\x2d05\x2d15')
    trip_type = request.args.get('tripType', 'one_way')
    return_date = request.args.get('returnDate', '')

    from_id = get_location_id(user_origin)
    to_id = get_location_id(user_dest)

    if not from_id or not to_id:
        return jsonify({"error": "could not find airport ids"}), 400

    url = f"https://{api_host}/api/v1/flights/searchFlights"
    
    querystring = {
        "fromId": from_id,
        "toId": to_id,
        "departDate": user_date, 
        "pageNo": "1",
        "adults": "1",
        "sort": "BEST",
        "cabinClass": "ECONOMY",
        "currency_code": "SGD"
    }

    if trip_type == 'round_trip' and return_date:
        querystring["returnDate"] = return_date
    
    response = requests.get(url, headers=headers_dict, params=querystring)
    raw_json_data = response.json()
    
    all_tickets = raw_json_data.get('data', {}).get('flightOffers', [])
    clean_flights = []
    
    for ticket in all_tickets:
        price_info = ticket.get('priceBreakdown', {}).get('total', {})
        currency = price_info.get('currencyCode')
        cost = price_info.get('units')
        
        airline_name = "Unknown"
        departure_time = "Unknown"
        arrival_time = "Unknown"
        return_dep = None
        return_arr = None
        total_time_seconds = 0
        
        segments = ticket.get('segments', [])
        if len(segments) > 0:
            departure_time = segments[0].get('departureTime', 'Unknown')
            arrival_time = segments[0].get('arrivalTime', 'Unknown')
            total_time_seconds += segments[0].get('totalTime', 0)
            
            legs = segments[0].get('legs', [])
            if len(legs) > 0:
                carriers = legs[0].get('carriersData', [])
                if len(carriers) > 0:
                    airline_name = carriers[0].get('name')

        if len(segments) > 1:
            return_dep = segments[1].get('departureTime', 'Unknown')
            return_arr = segments[1].get('arrivalTime', 'Unknown')
            total_time_seconds += segments[1].get('totalTime', 0)
        
        clean_flights.append({
            "airline": airline_name,
            "price": cost,
            "currency": currency,
            "departure": departure_time,
            "arrival": arrival_time,
            "return_departure": return_dep,
            "return_arrival": return_arr,
            "is_round_trip": len(segments) > 1,
            "total_time": total_time_seconds
        })
        
    return jsonify(clean_flights)

@app.route('/api/save_flight', methods=['POST'])
def save_flight():
    data = request.json
    conn = get_db_connection()
    cursor = conn.cursor()
    
    sql = "INSERT INTO saved_flights (airline, price, currency, departure_time, arrival_time, return_departure, return_arrival, is_round_trip, total_time) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)"
    
    values = (
        data.get('airline'),
        data.get('price'),
        data.get('currency'),
        data.get('departure'),
        data.get('arrival'),
        data.get('return_departure'),
        data.get('return_arrival'),
        data.get('is_round_trip'),
        data.get('total_time')
    )
    
    try:
        cursor.execute(sql, values)
        conn.commit()
        return jsonify({"message": "flight successfully saved to database"}), 201
    except Exception as e:
        print("database error", e)
        return jsonify({"error": "failed to save flight"}), 500
    finally:
        cursor.close()
        conn.close()
        
@app.route('/api/saved_flights', methods=['GET'])
def get_saved_flights():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # fetch all flights and order them by departure time for the graph
        cursor.execute("SELECT * FROM saved_flights ORDER BY departure_time ASC")
        flights = cursor.fetchall()
        return jsonify(flights), 200
    except Exception as e:
        print("database error", e)
        return jsonify({"error": "failed to fetch saved flights"}), 500
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)