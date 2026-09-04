-- Migration: 001_initial_schema.sql
-- Purpose: Create initial database schema with PostGIS support

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('CITIZEN', 'SURVEYOR', 'REGISTRAR')),
    e_kyc_verified BOOLEAN DEFAULT false,
    e_kyc_document_hash VARCHAR(255),
    wallet_address VARCHAR(42),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email and wallet address
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_wallet ON users(wallet_address);

-- Land Parcels table (with PostGIS geometry column)
CREATE TABLE IF NOT EXISTS land_parcels (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ulpin VARCHAR(50) UNIQUE NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    geometry GEOMETRY(Polygon, 4326) NOT NULL,
    area_in_sq_meters DECIMAL(18, 4) NOT NULL,
    total_value VARCHAR(255) DEFAULT '0',
    location JSONB,
    document_ipfs_cid VARCHAR(255),
    blockchain_hash VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create spatial index on geometry column
CREATE INDEX idx_land_parcels_geometry ON land_parcels USING GIST(geometry);
CREATE INDEX idx_land_parcels_owner ON land_parcels(owner_id);
CREATE INDEX idx_land_parcels_ulpin ON land_parcels(ulpin);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id UUID NOT NULL REFERENCES land_parcels(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    seller_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (
        status IN (
            'PENDING',
            'LOCKED_IN_ESCROW',
            'BUYER_APPROVED',
            'SELLER_APPROVED',
            'REGISTRAR_APPROVED',
            'COMPLETED',
            'REJECTED',
            'CANCELLED'
        )
    ),
    deed_ipfs_cid VARCHAR(255) NOT NULL,
    multi_sig_contract_address VARCHAR(42),
    multi_sig_tx_hash VARCHAR(255),
    buyer_approved_at TIMESTAMP,
    seller_approved_at TIMESTAMP,
    registrar_approved_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes on transactions
CREATE INDEX idx_transactions_parcel ON transactions(parcel_id);
CREATE INDEX idx_transactions_buyer ON transactions(buyer_id);
CREATE INDEX idx_transactions_seller ON transactions(seller_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);

-- Audit Log table
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on audit log
CREATE INDEX idx_audit_log_transaction ON audit_log(transaction_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);

-- Spatial overlap check function
CREATE OR REPLACE FUNCTION check_parcel_overlap()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM land_parcels
        WHERE id != NEW.id
        AND ST_Overlaps(geometry, NEW.geometry)
    ) THEN
        RAISE EXCEPTION 'Land parcel overlaps with existing parcel';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for spatial validation
CREATE TRIGGER trigger_check_parcel_overlap
BEFORE INSERT OR UPDATE ON land_parcels
FOR EACH ROW
EXECUTE FUNCTION check_parcel_overlap();

-- Function to calculate parcel area in square meters
CREATE OR REPLACE FUNCTION calculate_parcel_area()
RETURNS TRIGGER AS $$
BEGIN
    NEW.area_in_sq_meters := ST_Area(NEW.geometry::geography) / 10000.0;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-calculate area
CREATE TRIGGER trigger_calculate_area
BEFORE INSERT OR UPDATE ON land_parcels
FOR EACH ROW
EXECUTE FUNCTION calculate_parcel_area();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at columns
CREATE TRIGGER trigger_update_users_timestamp
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trigger_update_parcels_timestamp
BEFORE UPDATE ON land_parcels
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER trigger_update_transactions_timestamp
BEFORE UPDATE ON transactions
FOR EACH ROW
EXECUTE FUNCTION update_timestamp();

-- Create view for pending transfers with details
CREATE OR REPLACE VIEW v_pending_transfers AS
SELECT
    t.id,
    t.parcel_id,
    lp.ulpin,
    lp.area_in_sq_meters,
    lp.location,
    u_seller.full_name AS seller_name,
    u_seller.email AS seller_email,
    u_buyer.full_name AS buyer_name,
    u_buyer.email AS buyer_email,
    t.status,
    t.deed_ipfs_cid,
    t.buyer_approved_at,
    t.seller_approved_at,
    t.registrar_approved_at,
    t.created_at,
    t.updated_at
FROM transactions t
LEFT JOIN land_parcels lp ON t.parcel_id = lp.id
LEFT JOIN users u_seller ON t.seller_id = u_seller.id
LEFT JOIN users u_buyer ON t.buyer_id = u_buyer.id
WHERE t.status IN ('PENDING', 'LOCKED_IN_ESCROW', 'BUYER_APPROVED', 'SELLER_APPROVED');

-- Create view for completed transfers
CREATE OR REPLACE VIEW v_completed_transfers AS
SELECT
    t.id,
    t.parcel_id,
    lp.ulpin,
    lp.owner_id AS new_owner_id,
    u_owner.full_name AS owner_name,
    u_owner.email AS owner_email,
    t.status,
    t.deed_ipfs_cid,
    t.completed_at,
    t.created_at
FROM transactions t
LEFT JOIN land_parcels lp ON t.parcel_id = lp.id
LEFT JOIN users u_owner ON lp.owner_id = u_owner.id
WHERE t.status = 'COMPLETED';

-- Create view for user statistics
CREATE OR REPLACE VIEW v_user_statistics AS
SELECT
    role,
    COUNT(*) as total_users,
    SUM(CASE WHEN e_kyc_verified THEN 1 ELSE 0 END) as verified_users,
    COUNT(DISTINCT wallet_address) as users_with_wallet
FROM users
GROUP BY role;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO postgres;
