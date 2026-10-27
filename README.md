# TeamApo Hub - Event Management Tool

## Features

- **Event Creation & Management** - Create and manage tech events with ease
- **Manual Payment Verification** - Bank transfer / GCash receipt upload with an admin review queue
- **QR Code Attendance** - Seamless check-in system with QR codes
- **Certificate Generation** - Automated certificate creation for attendees
- **Analytics Dashboard** - Comprehensive event analytics and reporting
- **Admin & Organizer Access** - Role-based authentication for administrators and organizers
- **Anonymous Attendee Registration** - No account required for event participants
- **Mobile Responsive** - Optimized for all devices

## Quick Start

### Prerequisites
- Node.js 18+ or Bun 1.0+
- Firebase account and project

### Installation
```bash
# Clone the repository
git clone https://github.com/gdgdavao/teamapo-hub.git
cd teamapo-hub

# Install dependencies (using Bun - recommended)
bun install

# Copy environment variables
cp .env.example .env

# Start local development server with emulators and sample data
bun run dev:apohub
```

Visit `http://localhost:5173` to see the application running.

## Documentation

Start with [Product](PRODUCT.md), then [Contributing Guidelines](CONTRIBUTING.md).

| Document | What it covers |
|---|---|
| [PRODUCT.md](PRODUCT.md) | What the product is, who it serves, brand personality, anti-references |
| [DESIGN.md](DESIGN.md) | Material Design 3 tokens: colour roles, typography, elevation, components |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | Design system companion: spacing, control geometry, state layer, motion, responsive rules, browser floor, iOS hardening, accessibility, anti-patterns |
| [docs/PRD.md](docs/PRD.md) | Product requirements, personas, feature modules, success metrics |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Complete setup and development instructions |
| [docs/Architecture.md](docs/Architecture.md) | System design, data flows, infrastructure |
| [docs/Schema.md](docs/Schema.md) | Firestore collections, fields, and indexes |
| [docs/Rules.md](docs/Rules.md) | Security rules architecture and code standards |
| [docs/PROJECT_STRUCTURE.md](docs/PROJECT_STRUCTURE.md) | Repository map |
| [AGENTS.md](AGENTS.md) | Operating rules for AI coding assistants and skills |
| [CONTRIBUTING.md](CONTRIBUTING.md) | How to contribute, coding guidelines, PR process |
| [SECURITY.md](SECURITY.md) | Reporting a vulnerability |
| [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) | Community expectations |

## Tech Stack

- **Frontend**: React 19 + TypeScript 5.7
- **Build Tool**: Vite 6
- **Package Manager**: Bun (never npm, npx, yarn, or pnpm)
- **Styling**: Tailwind CSS 3.4 with a **Material Design 3** token system. Components reference MD3 colour *roles* (`bg-primary`, `bg-surface-container-low`, `text-on-surface`, `border-outline`), never brand names (`bg-blue-600`). Full definitions in [DESIGN.md](DESIGN.md), rules in [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md)
- **Backend**: Firebase 11 (Auth, Firestore, Functions, Storage)
- **Payments**: Manual verification (bank transfer / GCash proof upload)
- **Icons**: Heroicons + Lucide React
- **Forms**: React Hook Form
- **PDF Generation**: jsPDF + html2canvas
- **Testing**: Vitest (unit in `node`, components in `jsdom`), Firebase Rules Unit Testing
- **CI**: Verification quality gates (TypeScript typecheck, ESLint, Vitest unit & DOM suites, production build)

## Getting Started as a Contributor

1. **Read the docs**: Start with our [Development Guide](docs/DEVELOPMENT.md)
2. **Set up your environment**: Follow the installation instructions
3. **Check the issues**: Look for `good-first-issue` labels
4. **Join the community**: Connect with us on our community channels

### Environment Setup
1. Create a Firebase project and configure authentication
2. Set up Firestore database with appropriate security rules
3. Configure event payment methods (bank details + QR) in the admin event editor
4. Update environment variables in `.env`

For detailed setup instructions, see our [Development Guide](docs/DEVELOPMENT.md).

## Contributing

We welcome contributions from the GDG Davao community and beyond!

### How to Contribute
- **Report bugs** using our issue templates
- **Suggest features** with detailed proposals
- **Submit code** via pull requests
- **Improve documentation**
- **Enhance UI/UX**

Please read our [Contributing Guidelines](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

### Quick Contribution Steps
```bash
# Fork the repo and clone your fork
git clone https://github.com/YOUR_USERNAME/teamapo-hub.git

# Create a feature branch
git checkout -b feature/amazing-feature

# Make your changes and commit
git commit -m "feat: add amazing feature"

# Push and create a pull request
git push origin feature/amazing-feature
```

## Contributors

<a href="https://github.com/gdgdavao/teamapo-hub/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=gdgdavao/teamapo-hub" alt="Contributors" />
</a>

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support & Community

- **Email**: support@gdgdavao.org
- **Issues**: [GitHub Issues](https://github.com/gdgdavao/teamapo-hub/issues)
- **Discussions**: [GitHub Discussions](https://github.com/gdgdavao/teamapo-hub/discussions)
- **GDG Davao**: Join our local meetups and events

## Special Mentions
- [DICE ImaGen](https://github.com/dicedvo/imagen) - Certificate Builder

---

**Built by the GDG Davao community**
