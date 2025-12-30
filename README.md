# Pharmacy Management System

A modern pharmacy management system with React frontend and Node.js/Express backend for browsing and searching medicine data.

## Features

- 🔍 **Search Functionality**: Search medicines by product name, generic name, manufacturer, or registration number
- 🎯 **Advanced Filters**: Filter by category, manufacturer, and price range
- 📊 **Statistics Dashboard**: View total medicines, categories, manufacturers, and price statistics
- 📱 **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- 🎨 **Modern UI**: Beautiful gradient design with smooth animations

## Project Structure

```
PMC Data/
├── backend/
│   └── server.js          # Express backend server
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── App.js
│   │   ├── App.css
│   │   ├── index.js
│   │   └── index.css
│   └── package.json
├── drap_page1.json        # Medicine data source
└── package.json           # Root package.json
```

## Installation

### Option 1: Install Everything at Once
```bash
npm run install-all
```

### Option 2: Install Separately

1. **Install backend dependencies:**
```bash
npm install
```

2. **Install frontend dependencies:**
```bash
npm run install-frontend
```

## Running the Application

### Start Backend Server
```bash
npm start
```
The backend server will run on `http://localhost:5001`

### Start Frontend (in a new terminal)
```bash
npm run frontend
```
The frontend will run on `http://localhost:3000`

## API Endpoints

- `GET /api/medicines` - Get all medicines with optional filters
  - Query parameters: `search`, `category`, `manufacturer`, `minPrice`, `maxPrice`, `page`, `limit`
- `GET /api/medicines/:regNumber` - Get a specific medicine by registration number
- `GET /api/categories` - Get all unique categories
- `GET /api/manufacturers` - Get all unique manufacturers
- `GET /api/statistics` - Get statistics about the medicine database

## Usage

1. Start both the backend and frontend servers
2. Open your browser and navigate to `http://localhost:3000`
3. Use the search bar to find medicines
4. Click "Show Filters" to apply advanced filters
5. Browse through paginated results

## Technologies Used

- **Frontend**: React 18, CSS3
- **Backend**: Node.js, Express.js
- **Data Source**: JSON file (drap_page1.json)

## Development

For development with auto-reload on backend changes:
```bash
npm run dev
```

## License

MIT


Hostinger db pharmacy Password:Pharmacy@5512