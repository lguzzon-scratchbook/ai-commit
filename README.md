<p align="center">
  <img width="400px" alt="AI-Commit: The Commit Message Generator" src="https://user-images.githubusercontent.com/20267733/218333677-ebdb09e5-9487-434c-92f5-f4bdcc76f632.png" width="100%">
</p>

<h1 align="center">AI-Commit: The Commit Message Generator</h1>

<p align="center">
  <strong>💻 Tired of writing boring commit messages? Let AI-Commit help!</strong>
</p>

<p align="center">
  AI-Commit uses the power of OpenAI's GPT model to understand your code changes and generate meaningful commit messages. Whether you're working on a solo project or collaborating with a team, AI-Commit makes it easy to keep your commit history organized and informative.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/ai-commit">
    <img src="https://img.shields.io/npm/v/ai-commit.svg" alt="NPM Version">
  </a>
  <a href="https://github.com/insulineru/ai-commit/actions">
    <img src="https://github.com/insulineru/ai-commit/workflows/CI/badge.svg" alt="CI Status">
  </a>
  <a href="https://codecov.io/gh/insulineru/ai-commit">
    <img src="https://codecov.io/gh/insulineru/ai-commit/branch/main/graph/badge.svg" alt="Coverage">
  </a>
  <a href="https://standardjs.com">
    <img src="https://img.shields.io/badge/code_style-standard-brightgreen.svg" alt="Code Style">
  </a>
  <a href="LICENSE">
    <img src="https://img.shields.io/npm/l/ai-commit.svg" alt="License">
  </a>
</p>

## 🚀 Features

- **AI-Powered Commit Messages**: Generate meaningful commit messages using OpenAI's GPT models
- **Conventional Commits**: Follow the conventional commit format with gitmojis
- **Multiple Suggestions**: Get multiple commit message options to choose from
- **Release Summaries**: Generate release summaries from recent commits
- **Security Hardened**: Command injection protection and input validation
- **Comprehensive Testing**: 100% test coverage with Jest
- **Modern Architecture**: ES2022 features, dependency injection, and modular design
- **Developer Experience**: Comprehensive documentation and contribution guidelines

## 📦 Installation

### Global Installation

```bash
npm install -g ai-commit
```

### Local Development

```bash
git clone https://github.com/insulineru/ai-commit.git
cd ai-commit
npm install
```

## 🔧 Setup

### Environment Variables

Create a `.env` file in your project root:

```env
# OpenAI API Key (required)
OPENAI_API_KEY=your_openai_api_key_here

# Alternative: OpenRouter API Key
OPENROUTER_API_KEY=your_openrouter_api_key_here

# Model Configuration (optional)
OPENROUTER_MODEL=openrouter/auto
OPENAI_MODEL=gpt-3.5-turbo

# Application Settings (optional)
AI_COMMIT_VERBOSE=false
AI_COMMIT_FORCE=false
AI_COMMIT_FILTER_FEE=true
AI_COMMIT_UNIFIED=1
AI_COMMIT_ALL=false
AI_COMMIT_RELEASE=false
AI_COMMIT_PROMPT=v04
```

### API Keys

1. **OpenAI**: Get your API key from [OpenAI Platform](https://platform.openai.com/account/api-keys)
2. **OpenRouter**: Get your API key from [OpenRouter](https://openrouter.ai/keys)

## 🎯 Usage

### Basic Usage

1. Make your code changes and stage them:
   ```bash
   git add .
   ```

2. Run AI-Commit:
   ```bash
   ai-commit
   ```

3. Review and approve the generated commit message

### Command Line Options

```bash
# Get multiple suggestions
ai-commit --list

# Force commit without confirmation
ai-commit --force

# Show API cost before proceeding
ai-commit --filter-fee

# Generate release summary
ai-commit --release

# Commit all staged files with single message
ai-commit --all

# Use unified diff with specific context lines
ai-commit --unified 3
```

### Environment Variables

```bash
# Set API key directly (not recommended for production)
ai-commit --apiKey your_api_key

# Enable verbose logging
AI_COMMIT_VERBOSE=true ai-commit

# Enable force mode
AI_COMMIT_FORCE=true ai-commit
```

## 🛠️ Development

### Prerequisites

- Node.js 18+ (recommended: latest LTS)
- npm 8+
- Git

### Setting Up Development Environment

```bash
# Clone the repository
git clone https://github.com/insulineru/ai-commit.git
cd ai-commit

# Install dependencies
npm install

# Install development dependencies
npm install

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run linting
npm run check

# Generate documentation
npm run docs
```

### Project Structure

```
ai-commit/
├── src/                    # Source code
│   ├── api/               # API client and communication
│   ├── commit/            # Commit message generation
│   ├── config/            # Configuration management
│   ├── di/                # Dependency injection
│   ├── errors/            # Error handling
│   ├── git/               # Git operations
│   ├── logger/            # Logging utilities
│   ├── security/          # Security utilities
│   └── app.js             # Main application
├── tests/                 # Test files
├── docs/                  # Generated documentation
├── lib/                   # Legacy utilities (deprecated)
└── README.md             # This file
```

### Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests for CI
npm run test:ci
```

### Code Quality

```bash
# Lint and fix code
npm run check

# Run linting only
npx standard .

# Run type checking (if TypeScript were added)
npm run type-check
```

### Building Documentation

```bash
# Generate API documentation
npm run docs

# The documentation will be available in docs/ directory
```

## 🏗️ Architecture

AI-Commit follows a modular architecture with clear separation of concerns:

- **Security**: Input validation and command injection protection
- **Error Handling**: Standardized error codes and categories
- **Dependency Injection**: Loose coupling and testability
- **Testing**: Comprehensive test coverage with Jest
- **Documentation**: JSDoc and TypeDoc integration

For detailed architecture decisions, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## 📋 Contributing

We welcome contributions! Please follow these guidelines:

### Development Workflow

1. **Fork and Clone**
   ```bash
   fork https://github.com/insulineru/ai-commit.git
   git clone https://github.com/your-username/ai-commit.git
   cd ai-commit
   ```

2. **Set Up Development Environment**
   ```bash
   npm install
   cp .env.example .env
   # Edit .env with your API key for testing
   ```

3. **Create Feature Branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```

4. **Make Changes**
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed
   - Ensure all tests pass

5. **Test Your Changes**
   ```bash
   npm test
   npm run test:coverage
   npm run check
   ```

6. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add amazing feature"
   ```

7. **Push and Create Pull Request**
   ```bash
   git push origin feature/amazing-feature
   ```

### Code Style

- Follow [Standard.js](https://standardjs.com/) style guide
- Use ES2022+ features
- Add JSDoc comments for all public methods
- Write comprehensive tests
- Keep functions small and focused

### Testing Guidelines

- Aim for 100% test coverage
- Write both unit and integration tests
- Mock external dependencies
- Test error cases and edge conditions
- Use descriptive test names

### Pull Request Process

1. Update documentation as needed
2. Ensure tests pass and coverage is maintained
3. PR description should explain the changes and their rationale
4. Link to any related issues
5. Ensure CI/CD pipeline passes

## 🔒 Security

AI-Commit takes security seriously. We've implemented:

- **Input Validation**: All user inputs are validated and sanitized
- **Command Injection Protection**: Git commands use parameterized inputs
- **Environment Variable Security**: Sensitive data handled securely
- **Dependency Scanning**: Regular security audits of dependencies

For security details, see [SECURITY.md](./SECURITY.md).

## 📚 Documentation

- **API Documentation**: Generated with TypeDoc (`npm run docs`)
- **Architecture Decisions**: See [ARCHITECTURE.md](./ARCHITECTURE.md)
- **Code Documentation**: JSDoc comments throughout the codebase
- **README**: This file provides comprehensive usage and development information

## 🚀 Roadmap

### Completed
- [x] Support for multiple suggestions
- [x] Security hardening and input validation
- [x] Comprehensive testing infrastructure
- [x] Modern ES2022+ features
- [x] Dependency injection system
- [x] Documentation generation
- [x] CI/CD pipeline

### Planned
- [ ] Support for custom commit types
- [ ] Automated scope detection
- [ ] Improved emoji suggestions
- [ ] Commit message templating
- [ ] Interactive commit message generation
- [ ] Integration with Git hooks
- [ ] Advanced diff analysis
- [ ] Reverse commit message generation

## 🤝 Support

- **Issues**: [GitHub Issues](https://github.com/insulineru/ai-commit/issues)
- **Discussions**: [GitHub Discussions](https://github.com/insulineru/ai-commit/discussions)
- **Email**: insuline.ru@gmail.com

## 📄 License

AI-Commit is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [OpenAI](https://openai.com/) for the GPT models
- [OpenRouter](https://openrouter.ai/) for alternative API access
- [Conventional Commits](https://www.conventionalcommits.org/) for the commit message standard
- [Gitmoji](https://gitmoji.dev/) for the awesome emoji guide

---

<div align="center">
  <strong>Made with ❤️ by the AI-Commit team</strong>
</div>
