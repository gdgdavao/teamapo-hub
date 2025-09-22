# APOHUB 🎯

> Modern event management platform for GDG Davao community

A comprehensive event management system built with React, TypeScript, and Firebase, designed specifically for the Google Developer Group (GDG) Davao community.

## ✨ Features

- 🎫 **Event Creation & Management** - Create and manage tech events with ease
- 💳 **Payment Processing** - Integrated Paymongo payment system for Philippine market
- 📱 **QR Code Attendance** - Seamless check-in system with QR codes
- 🏆 **Certificate Generation** - Automated certificate creation for attendees
- 📊 **Analytics Dashboard** - Comprehensive event analytics and reporting
- 🔐 **Admin & Organizer Access** - Role-based authentication for administrators and organizers
- 👥 **Anonymous Attendee Registration** - No account required for event participants
- 📱 **Mobile Responsive** - Optimized for all devices

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ or Bun 1.0+
- Firebase account and project
- Paymongo account (for Philippines)

### Installation
```bash
# Clone the repository
git clone https://github.com/gdgdavao/apohub.git
cd apohub-gdgdavao

# Install dependencies (using Bun - recommended)
bun install

# Copy environment variables
cp env.example .env.local

# Start development server
bun run dev
```

Visit `http://localhost:5173` to see the application running.

## 📚 Documentation

- **[Development Guide](docs/DEVELOPMENT.md)** - Complete setup and development instructions
- **[Contributing Guidelines](CONTRIBUTING.md)** - How to contribute to the project
- **[Project Structure](docs/PROJECT_STRUCTURE.md)** - Detailed architecture overview

## 🛠️ Tech Stack

- **Frontend**: React 19 + TypeScript 5.7
- **Build Tool**: Vite 6
- **Package Manager**: Bun
- **Styling**: Tailwind CSS 3.4 with Google Design System
- **Backend**: Firebase 11 (Auth, Firestore, Functions, Storage)
- **Payment**: Paymongo API (QRPH, GCash, Bank Transfer)
- **Icons**: Heroicons + Lucide React
- **Forms**: React Hook Form
- **PDF Generation**: jsPDF + html2canvas

## 🌟 Getting Started as a Contributor

1. **Read the docs**: Start with our [Development Guide](docs/DEVELOPMENT.md)
2. **Set up your environment**: Follow the installation instructions
3. **Check the issues**: Look for `good-first-issue` labels
4. **Join the community**: Connect with us on our community channels

### Environment Setup
1. Create a Firebase project and configure authentication
2. Set up Firestore database with appropriate security rules
3. Configure Paymongo API keys for payment processing
4. Update environment variables in `.env.local`

For detailed setup instructions, see our [Development Guide](docs/DEVELOPMENT.md).

## 🤝 Contributing

We welcome contributions from the GDG Davao community and beyond!

### How to Contribute
- 🐛 **Report bugs** using our issue templates
- ✨ **Suggest features** with detailed proposals
- 💻 **Submit code** via pull requests
- 📚 **Improve documentation**
- 🎨 **Enhance UI/UX**

Please read our [Contributing Guidelines](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

### Quick Contribution Steps
```bash
# Fork the repo and clone your fork
git clone https://github.com/YOUR_USERNAME/apohub.git

# Create a feature branch
git checkout -b feature/amazing-feature

# Make your changes and commit
git commit -m "feat: add amazing feature"

# Push and create a pull request
git push origin feature/amazing-feature
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support & Community

- **📧 Email**: davao.gdg@gmail.com
- **🐛 Issues**: [GitHub Issues](https://github.com/gdgdavao/apohub/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/gdgdavao/apohub/discussions)
- **🎯 GDG Davao**: Join our local meetups and events


## Special Mentions
- [DICE ImaGen](https://github.com/dicedvo/imagen) - Certificate Builder

---

**Built with ❤️ by the GDG Davao community**
