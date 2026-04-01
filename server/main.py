from flask import Flask, jsonify, request
import difflib
import json
import requests
import pymysql
import os
from dotenv import load_dotenv
from locations import AIRPORT_CODES

load_dotenv()

app = Flask(__name__)

@app.after_request
def add_cors_headers(response):
    response.headers.add('Access\x2dControl\x2dAllow\x2dOrigin', '*')
    response.headers.add('Access\x2dControl\x2dAllow\x2dHeaders', 'Content\x2dType,Authorization')
    response.headers.add('Access\x2dControl\x2dAllow\x2dMethods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

def get_db_connection():
    return pymysql.connect(
        host='localhost',
        user='root',
        password=os.getenv("DB_PASSWORD"),
        database='flight_tracker',
        cursorclass=pymysql.cursors.DictCursor
    )

def get_iata_code(city_name):
    if not city_name:
        return ""
        
    city_lower = city_name.lower().strip()
    best_match_key = None
    
    if city_lower in AIRPORT_CODES:
        best_match_key = city_lower
    else:
        possible_matches = difflib.get_close_matches(city_lower, AIRPORT_CODES.keys(), n=1, cutoff=0.6)
        if possible_matches:
            best_match_key = possible_matches[0]
            print(f"auto-corrected spelling: '{city_name}' -> '{best_match_key}'")

    if best_match_key:
        codes = AIRPORT_CODES[best_match_key]
        
        if isinstance(codes, list):
            return ",".join(codes)
            
        return codes
        
    return city_name

@app.route('/api/flights')
def get_flights():
    user_origin = request.args.get('origin')
    user_dest = request.args.get('destination')
    user_date = request.args.get('date')
    trip_type = request.args.get('tripType', 'one_way')
    return_date = request.args.get('returnDate')
    
    max_stops = request.args.get('maxStops', 'any')

    if not user_origin or not user_dest or not user_date:
        return jsonify({"error": "missing parameters"}), 400

    iata_origin = get_iata_code(user_origin)
    iata_dest = get_iata_code(user_dest)

    api_host = "kiwi\x2dcom\x2dcheap\x2dflights.p.rapidapi.com"
    headers_dict = {
        "x\x2drapidapi\x2dkey": os.getenv("RAPIDAPI_KEY"),
        "x\x2drapidapi\x2dhost": api_host
    }

    outbound_start = f"{user_date}T00:00:00"
    outbound_end = f"{user_date}T23:59:59"

    base_querystring = {
        "source": iata_origin,
        "destination": iata_dest,
        "currency": "SGD",
        "locale": "en",
        "adults": "1",
        "children": "0",
        "infants": "0",
        "handbags": "1",
        "holdbags": "0",
        "cabinClass": "ECONOMY",
        "sortBy": "PRICE",
        "applyMixedClasses": "true",
        "allowChangeInboundDestination": "true",
        "allowChangeInboundSource": "true",
        "allowDifferentStationConnection": "true",
        "enableSelfTransfer": "true",
        "allowOvernightStopover": "true",
        "enableTrueHiddenCity": "true",
        "enableThrowAwayTicketing": "true",
        "transportTypes": "FLIGHT",
        "contentProviders": "FLIXBUS_DIRECTS,FRESH,KAYAK,KIWI",
        "limit": "20"
    }
    
    # apply the stopover limit if the user selected a specific number
    if max_stops != 'any':
        base_querystring['max_stopovers'] = max_stops

    if trip_type == 'round_trip' and return_date:
        url = f"https://{api_host}/round\x2dtrip"
        querystring = base_querystring.copy()
        querystring.update({
            "outboundDepartureDateStart": outbound_start,
            "outboundDepartureDateEnd": outbound_end,
            "outboundDepartmentDateStart": outbound_start,
            "outboundDepartmentDateEnd": outbound_end,
            "inboundDepartureDateStart": f"{return_date}T00:00:00",
            "inboundDepartureDateEnd": f"{return_date}T23:59:59",
            "allowReturnFromDifferentCity": "true",
            "allowReturnToDifferentCity": "false"
        })
    else:
        url = f"https://{api_host}/one\x2dway"
        querystring = base_querystring.copy()
        querystring.update({
            "outboundDepartureDateStart": outbound_start,
            "outboundDepartureDateEnd": outbound_end,
            "outboundDepartmentDateStart": outbound_start,
            "outboundDepartmentDateEnd": outbound_end,
            "allowReturnFromDifferentCity": "false",
            "allowReturnToDifferentCity": "false"
        })

    try:
        res = requests.get(url, headers=headers_dict, params=querystring)
        data = res.json()
        
        clean_flights = []
        all_tickets = data.get('itineraries', [])
        
        def extract_price(obj):
            if isinstance(obj, dict):
                if 'price' in obj and isinstance(obj['price'], dict) and 'amount' in obj['price']:
                    return float(obj['price']['amount'])
                for val in obj.values():
                    found = extract_price(val)
                    if found is not None:
                        return found
            elif isinstance(obj, list):
                for item in obj:
                    found = extract_price(item)
                    if found is not None:
                        return found
            return None

        for ticket in all_tickets:
            raw_price = extract_price(ticket)
            cost = round(raw_price, 2) if raw_price else 0
            
            outbound_data = ticket.get('outbound', {})
            inbound_data = ticket.get('inbound', {})
            
            if not outbound_data:
                outbound_data = ticket.get('sector', {})

            airline_name = "Unknown"
            departure_time = "Unknown"
            arrival_time = "Unknown"
            outbound_flight_no = "Unknown"
            total_time_seconds = outbound_data.get('duration', 0)
            
            out_segments = outbound_data.get('sectorSegments', [])
            outbound_transfers = []
            
            if len(out_segments) > 0:
                first_seg = out_segments[0].get('segment', {})
                last_seg = list(reversed(out_segments))[0].get('segment', {})
                
                departure_time = first_seg.get('source', {}).get('localTime', 'Unknown')
                arrival_time = last_seg.get('destination', {}).get('localTime', 'Unknown')
                airline_name = first_seg.get('carrier', {}).get('name', 'Unknown')
                
                carrier_code = first_seg.get('carrier', {}).get('code', '')
                flight_code = first_seg.get('code', '')
                outbound_flight_no = f"{carrier_code} {flight_code}".strip()

                # loop through the gaps to find the transfers
                if len(out_segments) > 1:
                    for i in range(1, len(out_segments)):
                        prev_seg = out_segments[i-1].get('segment', {})
                        curr_seg = out_segments[i].get('segment', {})
                        
                        transfer_city = prev_seg.get('destination', {}).get('station', {}).get('city', {}).get('name', 'Unknown City')
                        next_airline = curr_seg.get('carrier', {}).get('name', 'Unknown Airline')
                        next_carrier_code = curr_seg.get('carrier', {}).get('code', '')
                        next_flight_code = curr_seg.get('code', '')
                        
                        outbound_transfers.append({
                            "city": transfer_city,
                            "airline": next_airline,
                            "flight_number": f"{next_carrier_code} {next_flight_code}".strip()
                        })
            
            # --- PROCESS INBOUND ---
            return_dep = None
            return_arr = None
            return_flight_no = None
            is_round_trip = False
            inbound_transfers = []
            
            if inbound_data:
                is_round_trip = True
                total_time_seconds += inbound_data.get('duration', 0)
                in_segments = inbound_data.get('sectorSegments', [])
                
                if len(in_segments) > 0:
                    r_first = in_segments[0].get('segment', {})
                    r_last = list(reversed(in_segments))[0].get('segment', {})
                    
                    return_dep = r_first.get('source', {}).get('localTime', 'Unknown')
                    return_arr = r_last.get('destination', {}).get('localTime', 'Unknown')
                    
                    r_carrier_code = r_first.get('carrier', {}).get('code', '')
                    r_flight_code = r_first.get('code', '')
                    return_flight_no = f"{r_carrier_code} {r_flight_code}".strip()

                    # loop through the gaps to find return transfers
                    if len(in_segments) > 1:
                        for i in range(1, len(in_segments)):
                            prev_seg = in_segments[i-1].get('segment', {})
                            curr_seg = in_segments[i].get('segment', {})
                            
                            transfer_city = prev_seg.get('destination', {}).get('station', {}).get('city', {}).get('name', 'Unknown City')
                            next_airline = curr_seg.get('carrier', {}).get('name', 'Unknown Airline')
                            next_carrier_code = curr_seg.get('carrier', {}).get('code', '')
                            next_flight_code = curr_seg.get('code', '')
                            
                            inbound_transfers.append({
                                "city": transfer_city,
                                "airline": next_airline,
                                "flight_number": f"{next_carrier_code} {next_flight_code}".strip()
                            })

            clean_flights.append({
                "airline": airline_name,
                "price": cost,
                "currency": "SGD",
                "departure": departure_time,
                "arrival": arrival_time,
                "return_departure": return_dep,
                "return_arrival": return_arr,
                "is_round_trip": is_round_trip,
                "total_time": total_time_seconds,
                "flight_number": outbound_flight_no,
                "return_flight_number": return_flight_no,
                "outbound_transfers": outbound_transfers,
                "inbound_transfers": inbound_transfers
            })
            
        return jsonify(clean_flights)
        
    except Exception as e:
        print("error processing flights:", e)
        return jsonify({"error": "failed to process flights"}), 500

@app.route('/api/save_flight', methods=['POST'])
def save_flight():
    data = request.json
    route_name = data.get('route_name', 'Unknown Route')
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        sql = "INSERT INTO saved_flights (airline, price, currency, departure_time, arrival_time, is_round_trip, total_time, route_name, flight_number, return_flight_number, outbound_transfers, return_transfers) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"
        
        vals = (
            data.get('airline'), 
            data.get('price'), 
            data.get('currency'), 
            data.get('departure'), 
            data.get('arrival'), 
            data.get('is_round_trip', False), 
            data.get('total_time'), 
            route_name,
            data.get('flight_number', 'Unknown'),
            data.get('return_flight_number'),
            json.dumps(data.get('outbound_transfers', [])),
            json.dumps(data.get('inbound_transfers', []))
        )
        cursor.execute(sql, vals)
        conn.commit()
        return jsonify({"message": "flight saved successfully"}), 201
    except Exception as e:
        print("Database error:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()
        
@app.route('/api/saved_flights', methods=['GET'])
def get_saved_flights():
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT * FROM saved_flights ORDER BY departure_time ASC")
        flights = cursor.fetchall()
        return jsonify(flights), 200
    except Exception as e:
        print("database error", e)
        return jsonify({"error": "failed to fetch saved flights"}), 500
    finally:
        cursor.close()
        conn.close()

@app.route('/api/delete_graph', methods=['POST'])
def delete_graph():
    data = request.json
    route_name = data.get('route_name')
    is_round_trip = data.get('is_round_trip')
    departure_time = data.get('departure_time', '')

    date_prefix = departure_time[:10] if departure_time and len(departure_time) >= 10 else ''

    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if date_prefix:
            sql = "DELETE FROM saved_flights WHERE route_name = %s AND is_round_trip = %s AND departure_time LIKE %s"
            cursor.execute(sql, (route_name, is_round_trip, date_prefix + '%'))
        else:
            sql = "DELETE FROM saved_flights WHERE route_name = %s AND is_round_trip = %s"
            cursor.execute(sql, (route_name, is_round_trip))
            
        conn.commit()
        return jsonify({"message": "graph deleted successfully"}), 200
    except Exception as e:
        print("Database error:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()
        conn.close()

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)