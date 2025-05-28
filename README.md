## Getting Started

### Prerequisites
- Node.js 18+ or Bun
- Firebase account and project
- Paymongo account (for Philippines)

### Installation
```bash
# Clone the repository
git clone https://github.com/gdgdavao/apohub.git
cd apohub

# Install dependencies
bun install

# Copy environment variables
cp env.example .env.local

# Start development server
bun run dev
```

### Environment Setup
1. Create a Firebase project and configure authentication
2. Set up Firestore database with appropriate security rules
3. Configure Paymongo API keys for payment processing
4. Update environment variables in `.env.local`

For detailed setup instructions, see our [Development Guide](docs/DEVELOPMENT.md).

## Contributing

We welcome contributions from the GDG Davao community! Please read our [Contributing Guidelines](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For support, please reach out to the GDG Davao team at davao.gdg@gmail.com or create an issue in this repository.
