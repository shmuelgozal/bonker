# 🎯 Bonker - Ammunition Bunker Management System

A comprehensive web application for managing ammunition inventory across hierarchical military units. Designed for real-time inventory tracking, issuance management, and gap analysis.

## ✨ Features

✅ **Hierarchical Unit Management** - Battalion → Company → Storage Location structure  
✅ **Bunker Inventory Tracking** - Real-time ammunition stock levels  
✅ **Issuance Management** - Track ammunition handouts and bunker-to-bunker transfers  
✅ **תו תקן (Standard) Support** - Define and track inventory standards  
✅ **Gap Analysis** - Identify shortages and compliance issues  
✅ **CSV Export** - Export gap analysis data with Hebrew language support  
✅ **Multi-language Support** - Hebrew UI with English backend  
✅ **Mobile Responsive** - Works on Android phones, tablets, and desktops  

## 🚀 Live Demo

Access from anywhere:
```
Frontend: https://bonker-ammo-management.netlify.app
API: https://bonker-api.onrender.com
```

## 💻 Tech Stack

### Frontend
- React 18 + TypeScript
- Vite (blazing fast dev server)
- TailwindCSS (responsive design)
- axios (API communication)
- lucide-react (icons)
- react-router-dom (navigation)
- react-hot-toast (notifications)

### Backend
- Node.js + Express
- TypeScript
- SQLite (persistent storage)
- CORS enabled for cross-origin requests

## 📱 Mobile Access

### From Android Phone
1. Open Chrome/Firefox on your Android device
2. Go to: `https://bonker-ammo-management.netlify.app`
3. Add to homescreen for app-like experience:
   - **Chrome**: Menu (⋮) → "Add to Home screen"
   - **Firefox**: Menu (≡) → "Add to Home screen"

## 🔧 Development

### Prerequisites
- Node.js 18+
- npm 9+

### Setup Local Development

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/bonker-ammo-management.git
cd bonker-ammo-management

# Backend
cd tester/server
npm install
npm run dev

# Frontend (new terminal)
cd tester/client
npm install
npm run dev
```

Frontend: http://localhost:5173  
Backend: http://localhost:3001

### Project Structure
```
bonker/
├── tester/
│   ├── client/          # React frontend
│   │   ├── src/
│   │   │   ├── api/     # API client functions
│   │   │   ├── components/
│   │   │   ├── pages/   # React pages
│   │   │   └── types/   # TypeScript types
│   │   └── dist/        # Production build
│   └── server/          # Express backend
│       ├── src/
│       │   ├── db/      # Database schema & initialization
│       │   ├── routes/  # API endpoints
│       │   └── index.ts # Main server file
│       └── data/        # SQLite database file
├── fly.toml             # Fly.io deployment config
├── Dockerfile           # Docker containerization
├── DEPLOYMENT.md        # Detailed deployment guide
└── README.md
```

## 🌐 API Endpoints

### Units (Hierarchical Framework)
- `GET /api/units` - List all units
- `POST /api/units` - Create unit
- `GET /api/units/:id` - Get unit details
- `PUT /api/units/:id` - Update unit
- `DELETE /api/units/:id` - Delete unit
- `POST /api/units/:id/storage` - Add storage location

### Bunkers
- `GET /api/bunkers` - List bunkers
- `POST /api/bunkers` - Create bunker
- `GET /api/bunkers/:id` - Get bunker details
- `PUT /api/bunkers/:id` - Update bunker
- `DELETE /api/bunkers/:id` - Delete bunker

### Inventory
- `GET /api/bunkers/:id/inventory` - Get inventory
- `POST /api/bunkers/:id/inventory` - Update inventory
- `GET /api/bunkers/:id/gaps` - Get gap analysis
- `GET /api/bunkers/:id/standard` - Get תו תקן

### Issuances
- `GET /api/bunkers/:id/issuances` - List issuances
- `POST /api/bunkers/:id/issuances` - Create issuance
  - Supports `linked_bunker_id` for bunker-to-bunker transfers
  - Automatic inventory adjustment for transfers

### Ammo Types
- `GET /api/ammo-types` - List ammunition types
- `POST /api/ammo-types` - Create ammo type

## 📊 Key Features Explained

### Bunker-to-Bunker Transfer
Issuance with linked_bunker_id automatically:
- Deducts quantity from source bunker
- Adds quantity to destination bunker
- Creates entries for both with proper tracking

Example:
```json
POST /api/bunkers/2/issuances
{
  "linked_bunker_id": 3,
  "items": [{ "ammo_type_id": 1, "quantity": 50 }]
}
```

### CSV Export (Gap Analysis)
Export bunker gaps to CSV with:
- Hebrew headers and ammunition names
- UTF-8 encoding for proper display
- Status indicators (תקין/חלקי/חסר)
- Automatic filename with date

## 🚀 Deployment

### Quick Deploy (Recommended)

See [DEPLOYMENT.md](./DEPLOYMENT.md) for:
1. **GitHub setup** - Push code to GitHub
2. **Fly.io deployment** - Deploy backend
3. **Netlify deployment** - Deploy frontend
4. **Access from Android** - Full testing guide

### Free Hosting Options
- **Backend**: Fly.io (free tier, persistent storage, always-on)
- **Frontend**: Netlify (free tier, unlimited deployments)
- **Database**: SQLite (persisted to Fly.io volume)

**Total Cost: FREE** ✅

### Environment Variables
```
MONGODB_URI=        # Optional: for future MongoDB migration
PORT=3001           # Server port
NODE_ENV=production # Production flag
```

## 🔒 Security Notes

- CORS enabled for development and deployment URLs
- No authentication in current version (add if needed)
- Recommend running behind a firewall for sensitive use
- Data stored on Fly.io persistent volume (encrypted at rest)

## 📈 Future Enhancements

- [ ] User authentication & authorization
- [ ] MongoDB migration for better scalability
- [ ] Batch/Serial number tracking
- [ ] Audit logs
- [ ] Advanced reporting & analytics
- [ ] Mobile app (React Native)
- [ ] API key management
- [ ] Role-based access control (RBAC)

## 🛠️ Troubleshooting

### Build Errors
```bash
# Clear cache and reinstall
rm -r node_modules package-lock.json
npm install
npm run build
```

### CORS Issues
Check that both frontend and backend are deployed correctly, and CORS origins in `tester/server/src/index.ts` include your frontend URL.

### Database Issues
SQLite database is persisted to `/app/tester/server/data/bonker.db` on Fly.io. To reset:
```bash
flyctl ssh console
rm /app/tester/server/data/bonker.db
```

## 📝 License

MIT License - See LICENSE file for details

## 👨‍💻 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a pull request

## 📞 Support

- **Issues**: GitHub Issues
- **Documentation**: See DEPLOYMENT.md for deployment guide
- **Questions**: Open a GitHub discussion

---

**Made with ❤️ for ammunition management** 🎯
