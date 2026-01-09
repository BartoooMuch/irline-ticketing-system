-- SE 4458 Final Project - Airline Ticketing System Database Schema
-- Group 1

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- AIRPORTS TABLE (for caching)
-- ===========================================
CREATE TABLE airports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(3) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert some sample airports
INSERT INTO airports (code, name, city, country) VALUES
('IST', 'Istanbul Airport', 'Istanbul', 'Turkey'),
('SAW', 'Sabiha Gokcen International Airport', 'Istanbul', 'Turkey'),
('ESB', 'Esenboga International Airport', 'Ankara', 'Turkey'),
('ADB', 'Adnan Menderes Airport', 'Izmir', 'Turkey'),
('AYT', 'Antalya Airport', 'Antalya', 'Turkey'),
('BJV', 'Bodrum Airport', 'Bodrum', 'Turkey'),
('DLM', 'Dalaman Airport', 'Dalaman', 'Turkey'),
('TZX', 'Trabzon Airport', 'Trabzon', 'Turkey'),
('GZT', 'Gaziantep Airport', 'Gaziantep', 'Turkey'),
('VAN', 'Van Airport', 'Van', 'Turkey'),
('JFK', 'John F. Kennedy International Airport', 'New York', 'USA'),
('LAX', 'Los Angeles International Airport', 'Los Angeles', 'USA'),
('LHR', 'Heathrow Airport', 'London', 'UK'),
('CDG', 'Charles de Gaulle Airport', 'Paris', 'France'),
('FRA', 'Frankfurt Airport', 'Frankfurt', 'Germany'),
('AMS', 'Amsterdam Schiphol Airport', 'Amsterdam', 'Netherlands'),
('DXB', 'Dubai International Airport', 'Dubai', 'UAE');

-- ===========================================
-- AIRLINES TABLE
-- ===========================================
CREATE TABLE airlines (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(3) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    logo_url VARCHAR(500),
    is_miles_smiles_partner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert sample airlines
INSERT INTO airlines (code, name, is_miles_smiles_partner) VALUES
('TK', 'Turkish Airlines', TRUE),
('AJ', 'AJet', TRUE),
('PC', 'Pegasus Airlines', FALSE),
('XQ', 'SunExpress', FALSE),
('LH', 'Lufthansa', TRUE),
('BA', 'British Airways', FALSE);

-- ===========================================
-- FLIGHTS TABLE
-- ===========================================
CREATE TABLE flights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    flight_code VARCHAR(10) NOT NULL,
    airline_id UUID REFERENCES airlines(id),
    from_airport_id UUID REFERENCES airports(id) NOT NULL,
    to_airport_id UUID REFERENCES airports(id) NOT NULL,
    departure_date DATE NOT NULL,
    departure_time TIME NOT NULL,
    arrival_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    base_price DECIMAL(10, 2) NOT NULL,
    total_capacity INTEGER NOT NULL,
    available_capacity INTEGER NOT NULL,
    is_direct BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'SCHEDULED',
    created_by UUID,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_capacity CHECK (available_capacity >= 0 AND available_capacity <= total_capacity),
    CONSTRAINT different_airports CHECK (from_airport_id != to_airport_id)
);

-- Create indexes for flight searches
CREATE INDEX idx_flights_departure_date ON flights(departure_date);
CREATE INDEX idx_flights_from_airport ON flights(from_airport_id);
CREATE INDEX idx_flights_to_airport ON flights(to_airport_id);
CREATE INDEX idx_flights_status ON flights(status);
CREATE INDEX idx_flights_search ON flights(from_airport_id, to_airport_id, departure_date, status);

-- ===========================================
-- MILES SMILES MEMBERS TABLE
-- ===========================================
CREATE TABLE miles_smiles_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cognito_user_id VARCHAR(255) UNIQUE,
    member_number VARCHAR(20) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    title VARCHAR(10),
    date_of_birth DATE,
    phone VARCHAR(20),
    total_miles INTEGER DEFAULT 0,
    available_miles INTEGER DEFAULT 0,
    tier VARCHAR(20) DEFAULT 'CLASSIC',
    welcome_email_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT valid_miles CHECK (available_miles >= 0 AND available_miles <= total_miles)
);

-- Create indexes for members
CREATE INDEX idx_members_email ON miles_smiles_members(email);
CREATE INDEX idx_members_member_number ON miles_smiles_members(member_number);
CREATE INDEX idx_members_cognito_id ON miles_smiles_members(cognito_user_id);

-- ===========================================
-- TICKETS TABLE
-- ===========================================
CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ticket_number VARCHAR(20) UNIQUE NOT NULL,
    flight_id UUID REFERENCES flights(id) NOT NULL,
    member_id UUID REFERENCES miles_smiles_members(id),
    passenger_first_name VARCHAR(100) NOT NULL,
    passenger_last_name VARCHAR(100) NOT NULL,
    passenger_title VARCHAR(10),
    passenger_date_of_birth DATE,
    passenger_email VARCHAR(255),
    passenger_phone VARCHAR(20),
    seat_number VARCHAR(5),
    price_paid DECIMAL(10, 2) NOT NULL,
    miles_used INTEGER DEFAULT 0,
    miles_earned INTEGER DEFAULT 0,
    payment_method VARCHAR(20) DEFAULT 'CASH',
    status VARCHAR(20) DEFAULT 'CONFIRMED',
    booking_reference VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for tickets
CREATE INDEX idx_tickets_flight ON tickets(flight_id);
CREATE INDEX idx_tickets_member ON tickets(member_id);
CREATE INDEX idx_tickets_booking_ref ON tickets(booking_reference);
CREATE INDEX idx_tickets_status ON tickets(status);

-- ===========================================
-- MILES TRANSACTIONS TABLE
-- ===========================================
CREATE TABLE miles_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID REFERENCES miles_smiles_members(id) NOT NULL,
    ticket_id UUID REFERENCES tickets(id),
    transaction_type VARCHAR(20) NOT NULL,
    miles_amount INTEGER NOT NULL,
    description VARCHAR(500),
    source VARCHAR(50) DEFAULT 'FLIGHT',
    partner_airline_code VARCHAR(3),
    processed BOOLEAN DEFAULT FALSE,
    notification_sent BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for miles transactions
CREATE INDEX idx_miles_tx_member ON miles_transactions(member_id);
CREATE INDEX idx_miles_tx_processed ON miles_transactions(processed);
CREATE INDEX idx_miles_tx_notification ON miles_transactions(notification_sent);

-- ===========================================
-- NEW MEMBER QUEUE TABLE (for welcome emails)
-- ===========================================
CREATE TABLE new_member_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    member_id UUID REFERENCES miles_smiles_members(id) NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

CREATE INDEX idx_new_member_queue_processed ON new_member_queue(processed);

-- ===========================================
-- ADMIN USERS TABLE
-- ===========================================
CREATE TABLE admin_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    cognito_user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'ADMIN',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===========================================
-- FLIGHT PRICE PREDICTIONS CACHE TABLE
-- ===========================================
CREATE TABLE price_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_airport_code VARCHAR(3) NOT NULL,
    to_airport_code VARCHAR(3) NOT NULL,
    departure_date DATE NOT NULL,
    duration_minutes INTEGER NOT NULL,
    predicted_price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP + INTERVAL '24 hours'
);

CREATE INDEX idx_price_predictions ON price_predictions(from_airport_code, to_airport_code, departure_date);

-- ===========================================
-- NOTIFICATION LOG TABLE
-- ===========================================
CREATE TABLE notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_email VARCHAR(255) NOT NULL,
    notification_type VARCHAR(50) NOT NULL,
    subject VARCHAR(500),
    content TEXT,
    status VARCHAR(20) DEFAULT 'PENDING',
    error_message TEXT,
    sent_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notification_log_status ON notification_log(status);
CREATE INDEX idx_notification_log_type ON notification_log(notification_type);

-- ===========================================
-- API KEYS TABLE (for partner airlines)
-- ===========================================
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    airline_id UUID REFERENCES airlines(id),
    api_key VARCHAR(64) UNIQUE NOT NULL,
    api_secret_hash VARCHAR(255) NOT NULL,
    name VARCHAR(100) NOT NULL,
    permissions JSONB DEFAULT '["ADD_MILES"]',
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX idx_api_keys_key ON api_keys(api_key);

-- ===========================================
-- FUNCTIONS
-- ===========================================

-- Function to generate member number
CREATE OR REPLACE FUNCTION generate_member_number()
RETURNS VARCHAR(20) AS $$
DECLARE
    new_number VARCHAR(20);
BEGIN
    SELECT 'MS' || LPAD(COALESCE(MAX(SUBSTRING(member_number FROM 3)::INTEGER), 0) + 1 || '', 10, '0')
    INTO new_number
    FROM miles_smiles_members;
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate ticket number
CREATE OR REPLACE FUNCTION generate_ticket_number()
RETURNS VARCHAR(20) AS $$
DECLARE
    new_number VARCHAR(20);
BEGIN
    SELECT 'TK' || TO_CHAR(CURRENT_DATE, 'YYMMDD') || LPAD(COALESCE(
        (SELECT COUNT(*) + 1 FROM tickets WHERE DATE(created_at) = CURRENT_DATE)
    , 1)::TEXT, 6, '0')
    INTO new_number;
    RETURN new_number;
END;
$$ LANGUAGE plpgsql;

-- Function to generate booking reference
CREATE OR REPLACE FUNCTION generate_booking_reference()
RETURNS VARCHAR(10) AS $$
BEGIN
    RETURN UPPER(SUBSTRING(MD5(RANDOM()::TEXT || CLOCK_TIMESTAMP()::TEXT) FROM 1 FOR 6));
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- TRIGGERS
-- ===========================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_flights_updated_at BEFORE UPDATE ON flights
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON miles_smiles_members
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_airports_updated_at BEFORE UPDATE ON airports
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_airlines_updated_at BEFORE UPDATE ON airlines
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- SAMPLE DATA FOR TESTING
-- ===========================================

-- Insert sample flights
INSERT INTO flights (flight_code, airline_id, from_airport_id, to_airport_id, departure_date, departure_time, arrival_time, duration_minutes, base_price, total_capacity, available_capacity, is_direct)
SELECT 
    'TK' || LPAD(ROW_NUMBER() OVER()::TEXT, 4, '0'),
    (SELECT id FROM airlines WHERE code = 'TK'),
    f.id,
    t.id,
    CURRENT_DATE + (d || ' days')::INTERVAL,
    (TIME '06:00:00' + (h || ' hours')::INTERVAL),
    (TIME '06:00:00' + (h || ' hours')::INTERVAL + (dur || ' minutes')::INTERVAL),
    dur,
    (100 + RANDOM() * 400)::DECIMAL(10,2),
    180,
    180,
    TRUE
FROM airports f
CROSS JOIN airports t
CROSS JOIN generate_series(1, 7) d
CROSS JOIN generate_series(0, 3) h_idx
CROSS JOIN (VALUES (6), (9), (12), (15), (18), (21)) AS hours(h)
CROSS JOIN (VALUES (60), (90), (120), (150)) AS durations(dur)
WHERE f.country = 'Turkey' 
  AND t.country = 'Turkey'
  AND f.id != t.id
LIMIT 100;

COMMIT;
