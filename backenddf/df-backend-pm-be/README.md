# Backend - Dark Fantasy


## 🚀 Setup

Use Node.js 22 or newer. The backend uses AWS SDK for JavaScript v3 for S3, Rekognition and SES.

# Install Dependencies: 
- `npm install` or `npm i`


# Environment Setup:
- Set Up `.env` file


# Database Configuration : 
- **Local Database URL:** `mongodb://127.0.0.1:27017/darkfantasy` for a local MongoDB without authentication. Keep the credentials and `authSource` required by your database when authentication is enabled.
- **Live Database URL:** = `live_database_url` ( replace with your live database url )

Start MongoDB before the backend. If your database runs in Docker, Docker Desktop and the database container must both be running. A backend running directly on Windows needs the container's port published to localhost; a backend inside Docker uses the MongoDB service name.

Run `npm run db:check` to test the configured database with a five-second connection timeout. `ECONNREFUSED` on localhost port 27017 means MongoDB is not listening there. The AWS SDK warning is unrelated to this connection failure.

Blocking and moderation also require a MongoDB replica set with transactions and
change streams. A successful database ping alone does not verify this requirement.
With standalone MongoDB the backend exits during startup, and the Expo API proxy
returns HTTP 502 even for correct sign-in credentials.

The local Docker database has been configured as the single-node replica set
`rs0`, using its existing data volume. Keep the replica-set command and key file
when recreating the container. Windows backend connections use
`directConnection=true` in `DATABASE_URL` because the replica advertises the
Docker hostname `mongo-db:27017`. Docker clients on the same network can use that
hostname directly. Start the backend after MongoDB has elected its primary.


# Default server runs : 
- **Port:** `9000`
- **API Docs:** [http://localhost:9000/docs]


# Run Backend Server : 
- `npm run dev`


# API Documentation (Swagger):
- [http://localhost:9000/docs] ( Swagger UI )


# API Configuration
- **Public Site Domain:** = [http://13.126.173.69]


# server Be (BackEnd):
=> `git pull origin pm/be`
=> `npm run build` 
=> `pm2 restart backend`
=> `pm2 log backend`


# Note: 
=> Ensure `.env` variables are set correctly.
=> Restart the server after modifying environment variables
