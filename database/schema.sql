-- Drop existing tables for clean reset (optional)
DROP TABLE IF EXISTS battery_data, reservations, preferences, stations, users;

-- Users Table
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('user', 'station_owner') NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);



-- Reservations Table
CREATE TABLE reservations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    station_id INT,
    slot_reserved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    eta_minutes INT,
    expires_at TIMESTAMP,
    status ENUM('active', 'expired', 'cancelled') DEFAULT 'active',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE
);

-- Battery Data Table
CREATE TABLE battery_data (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    soc INT, -- State of Charge (0–100)
    soh INT, -- State of Health (0–100)
    temperature DOUBLE, -- Degrees Celsius
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- (Optional) User Preferences Table for Scoring
CREATE TABLE preferences (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    weight_cost FLOAT DEFAULT 0.25,
    weight_distance FLOAT DEFAULT 0.25,
    weight_wait_time FLOAT DEFAULT 0.25,
    weight_fast_charge FLOAT DEFAULT 0.25,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
