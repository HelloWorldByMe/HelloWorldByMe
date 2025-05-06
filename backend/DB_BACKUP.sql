-- Users table
CREATE TABLE users IF NOT EXISTS(
  user_id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Profiles table
CREATE TABLE profiles IF NOT EXISTS(
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) REFERENCES users(user_id),
  bio TEXT DEFAULT '',
  organization TEXT DEFAULT ''
);

-- Messages table
CREATE TABLE messages IF NOT EXISTS(
  id SERIAL PRIMARY KEY,
  sender VARCHAR(50) REFERENCES users(user_id),
  receiver VARCHAR(50) REFERENCES users(user_id),
  content TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  archived BOOLEAN DEFAULT FALSE
);

-- Audit log table (login/logout tracking)
CREATE TABLE audit_logs IF NOT EXISTS(
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) REFERENCES users(user_id),
  action VARCHAR(20), -- 'login' or 'logout'
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Organizations table
CREATE TABLE organizations IF NOT EXISTS(
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_by VARCHAR(50) REFERENCES users(user_id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Organization members with role-based access
CREATE TABLE organization_members IF NOT EXISTS(
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) REFERENCES users(user_id),
  org_id INTEGER REFERENCES organizations(id),
  role VARCHAR(20) DEFAULT 'member',  -- 'admin', 'member'
  joined_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, org_id)
);

-- Example of an endpoint to get user's role in an organization
CREATE VIEW user_organization_role AS
  SELECT user_id, org_id, role
  FROM organization_members;

CREATE TABLE clients IF NOT EXISTS(
 id serial primary key, 
 first_name varchar(100),
 last_name varchar(100),
 age int,
 gender varchar(50),
 veteran_stat varchar(50),
 num_children int,
 current_situation text,
 coordinates text,
 created_by varchar(50) references users(user_id),
 created_at timestamp default now()
);

CREATE TABLE notes IF NOT EXISTS(
 id serial primary key,
 client_id int references clients(id),
 user_id varchar(50) references users(user_id),
 note text not null,
 created_at timestamp default now()
);

CREATE TABLE services IF NOT EXISTS(
 id serial primary key,
 name varchar(100) not null,
 category varchar(100)
);

CREATE TABLE organization_services IF NOT EXISTS (
 id serial primary key,
 org_id int references organizations(id),
 service_id int references services(id),
 unique (org_id, service_id)
);

CREATE TABLE referrals IF NOT EXISTS(
 id serial primary key,
 client_id int references clients(id),
 org_id int references organizations(id),
 service_id int references services(id),
 status varchar(50) default 'pending',
 created_at timestamp default now()
);

CREATE TABLE join_requests IF NOT EXISTS(
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) REFERENCES users(user_id),
  org_id INTEGER REFERENCES organizations(id),
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  requested_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (user_id, org_id)
);


CREATE TABLE blogs IF NOT EXISTS(
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) REFERENCES users(user_id),
  content TEXT NOT NULL,
  organization TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE files IF NOT EXISTS(
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(50) REFERENCES users(user_id),
  file_path TEXT NOT NULL,
  organization TEXT,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE messages
  ADD COLUMN group_id INTEGER,        -- NULL for direct messages
  ADD COLUMN is_read BOOLEAN DEFAULT FALSE;


CREATE TABLE groups IF NOT EXISTS(
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_by VARCHAR(50) REFERENCES users(user_id)
);

CREATE TABLE group_members IF NOT EXISTS(
  group_id INTEGER REFERENCES groups(id),
  user_id VARCHAR(50) REFERENCES users(user_id),
  PRIMARY KEY (group_id, user_id)
);

CREATE TABLE message_reads IF NOT EXISTS(
  message_id INTEGER REFERENCES messages(id),
  user_id VARCHAR(50) REFERENCES users(user_id),
  read_at TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);
