# Security Policy

## 🛡️ Security Commitment

We are committed to maintaining a secure and trustworthy codebase for the ai-commit project. This document outlines our security policies, procedures, and best practices for contributors and users.

## 📋 Scope

This security policy applies to:
- All source code in the ai-commit repository
- Documentation and configuration files
- Build and deployment processes
- Third-party dependencies

## 🔒 Security Guidelines

### For Contributors

#### 1. Secure Coding Practices
- **Input Validation**: Always validate user inputs, especially for API keys and file paths
- **Command Injection Prevention**: Never use unsanitized user input in shell commands
- **Error Handling**: Implement proper error handling without exposing sensitive information
- **Dependency Management**: Regularly update dependencies to address security vulnerabilities

#### 2. Git Operations Security
- **Path Sanitization**: Validate all file paths before using them in git commands
- **Command Arguments**: Escape and sanitize all command arguments
- **Working Directory**: Always verify git repository safety before operations

#### 3. API Security
- **Environment Variables**: Store sensitive data (API keys) in environment variables
- **Rate Limiting**: Implement appropriate rate limiting for API calls
- **Error Messages**: Avoid exposing internal error details to users

### For Users

#### 1. API Key Management
- **Environment Variables**: Use `OPENAI_API_KEY` or `OPENROUTER_API_KEY` environment variables
- **Key Rotation**: Regularly rotate your API keys
- **Access Control**: Limit API key access to only necessary services

#### 2. Repository Safety
- **Trusted Repositories**: Only use ai-commit in trusted git repositories
- **Backup Important Data**: Always backup your commit messages before automated operations
- **Review Generated Content**: Always review AI-generated commit messages before committing

## 🚨 Vulnerability Reporting

### Reporting a Vulnerability

If you discover a security vulnerability in ai-commit, please follow these steps:

1. **Private Disclosure**: Report vulnerabilities privately to maintain security
   - Email: insuline.ru@gmail.com
   - GitHub Security Advisories: [Report via GitHub](https://github.com/insulineru/ai-commit/security/advisories/new)

2. **Include Details**: Provide the following information:
   - Description of the vulnerability
   - Steps to reproduce
   - Expected vs actual behavior
   - Potential impact
   - Suggested mitigation (if any)

3. **Do Not Disclose Publicly**: Avoid public disclosure until the vulnerability is patched

### Response Timeline

- **Initial Response**: Within 24 hours
- **Security Assessment**: Within 3 business days
- **Patch Development**: Within 7 business days (depending on complexity)
- **Release**: Within 14 business days of confirmation

## 🔧 Security Features

### Built-in Security Measures

1. **Input Sanitization**
   - File path validation
   - Shell argument escaping
   - Control character removal

2. **Error Handling**
   - Structured error codes
   - Safe error messages
   - Graceful failure handling

3. **Git Command Safety**
   - Path validation before git operations
   - Safe command construction
   - Working directory verification

### Configuration Security

1. **Environment Variables**
   - Required: `OPENAI_API_KEY` or `OPENROUTER_API_KEY`
   - Optional: Security-related flags and settings

2. **Validation Rules**
   - Git ref validation
   - File path safety checks
   - Commit message validation

## 📊 Regular Security Audits

### Automated Security Checks
- **Dependency Scanning**: Regular npm audit checks
- **Code Analysis**: Static security analysis with standard linting
- **Automated Testing**: Security-focused unit and integration tests

### Manual Security Reviews
- **Code Reviews**: All security-related changes require review
- **Penetration Testing**: Regular security assessments
- **Architecture Review**: Security review of major architectural changes

## 🚀 Security Best Practices

### Development Workflow

1. **Pre-commit Hooks**
   - Code linting and formatting
   - Security rule checking
   - Test execution

2. **CI/CD Pipeline**
   - Automated security scanning
   - Dependency vulnerability checks
   - Code coverage requirements

3. **Release Process**
   - Security review before release
   - Changelog security updates
   - Version pinning for critical dependencies

### Operational Security

1. **Key Management**
   - Use environment variables for sensitive data
   - Implement proper access controls
   - Regular key rotation

2. **Monitoring**
   - Monitor for unusual API usage
   - Log security-related events
   - Set up alerts for suspicious activity

## 📚 Resources

### Security Tools
- [Node.js Security Checklist](https://github.com/nodejs/node/security/policy)
- [OWASP NodeGoat](https://github.com/OWASP/nodegoat)
- [npm audit](https://docs.npmjs.com/cli/audit)

### Documentation
- [GitHub Security](https://docs.github.com/en/code-security/security-guides)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://github.com/goldbergyoni/nodebestpractices#-6-security-best-practices)

## 🤝 Contributing to Security

We welcome security contributions from the community. Please see our [Contributing Guidelines](CONTRIBUTING.md) for details on how to contribute security improvements.

### Security Bug Bounty Program
We are currently working on implementing a security bug bounty program. Stay tuned for updates!

## 📞 Contact

For security-related questions or concerns:
- **Email**: insuline.ru@gmail.com
- **GitHub Issues**: [Security Issues](https://github.com/insulineru/ai-commit/issues?q=is%3Aopen+is%3Aissue+label%3Asecurity)
- **Discussions**: [GitHub Discussions](https://github.com/insulineru/ai-commit/discussions)

## 📝 Changelog

### Security Updates
- **2024-01-15**: Initial security policy implementation
- **2024-01-15**: Added input sanitization for git operations
- **2024-01-15**: Implemented structured error handling
- **2024-01-15**: Added pre-commit security hooks

---

*This security policy is based on the [GitHub Security Policy Template](https://github.com/github/security-policy-template) and follows industry best practices.*