# Contributing to ChamaLink

Thank you for your interest in contributing to ChamaLink! We welcome contributions from developers, designers, product managers, and community members who want to help improve digital financial services for chama groups in Kenya.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Documentation](#documentation)
- [Community](#community)

## 🤝 Code of Conduct

### Our Pledge

We are committed to making participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment include:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

### Unacceptable Behavior

- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate in a professional setting

## 🚀 Getting Started

### Prerequisites

- Node.js 18 or higher
- npm or yarn
- Git
- Basic understanding of React, TypeScript, and Supabase

### Development Setup

1. **Fork and Clone**

   ```bash
   git fork https://github.com/yourusername/chamalink.git
   git clone https://github.com/yourusername/chamalink.git
   cd chamalink
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

3. **Environment Setup**

   ```bash
   cp .env.example .env.local
   # Edit .env.local with your Supabase credentials
   ```

4. **Start Development Server**

   ```bash
   npm run dev
   ```

5. **Verify Setup**
   - Open <http://localhost:5173>
   - Create a test account
   - Try basic features (works in development mode without M-PESA credentials)

## 🛠 Development Process

### Branching Strategy

We use a simplified Git flow:

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - Feature development branches
- `hotfix/*` - Critical bug fixes

### Workflow

1. **Create Feature Branch**

   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feature/your-feature-name
   ```

2. **Make Changes**
   - Write code following our standards
   - Add tests for new functionality
   - Update documentation

3. **Commit Changes**

   ```bash
   git add .
   git commit -m "feat: add user authentication with M-PESA verification"
   ```

4. **Push and Create PR**

   ```bash
   git push origin feature/your-feature-name
   # Create Pull Request on GitHub
   ```

### Commit Message Format

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**

- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation changes
- `style` - Code style changes (formatting, etc.)
- `refactor` - Code refactoring
- `test` - Adding or updating tests
- `chore` - Maintenance tasks

**Examples:**

```bash
feat(auth): add M-PESA phone verification
fix(loans): resolve calculation error in interest rates
docs(readme): update installation instructions
style(components): format SavingsCard component
refactor(api): simplify M-PESA integration logic
test(utils): add unit tests for validation functions
chore(deps): update React to v18.3.1
```

## 🔍 Pull Request Process

### Before Submitting

1. **Run Quality Checks**

   ```bash
   npm run lint
   npm run type-check
   npm run build
   ```

2. **Test Your Changes**

   ```bash
   npm run test
   # Manual testing of affected features
   ```

3. **Update Documentation**
   - Update README if needed
   - Add/update inline code comments
   - Update API documentation

### PR Requirements

Your PR must include:

- **Clear Description**: What problem does it solve?
- **Testing**: How did you test the changes?
- **Screenshots**: For UI changes
- **Breaking Changes**: Any backward compatibility issues?
- **Related Issues**: Link to relevant GitHub issues

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Performance improvement
- [ ] Code refactoring

## Testing
- [ ] Tested locally
- [ ] Added unit tests
- [ ] Manual testing completed

## Screenshots (if applicable)
[Add screenshots here]

## Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Code is properly commented
- [ ] Documentation updated
- [ ] No new warnings introduced
```

### Review Process

1. **Automated Checks**: CI/CD pipeline runs tests and linting
2. **Code Review**: At least one maintainer reviews the code
3. **Testing**: Manual testing for UI/UX changes
4. **Documentation Review**: Ensure docs are updated
5. **Merge**: Approved PRs are merged by maintainers

## 📝 Coding Standards

### TypeScript

- Use strict TypeScript configuration
- Prefer interfaces over types for object shapes
- Use proper type annotations
- Avoid `any` type unless absolutely necessary

```typescript
// Good
interface ChamaGroup {
  id: string;
  name: string;
  memberCount: number;
  currentAmount: number;
}

// Avoid
const group: any = { ... };
```

### React Components

- Use functional components with hooks
- Implement proper error boundaries
- Use React.memo for performance optimization when needed
- Follow single responsibility principle

```typescript
// Good
const SavingsCard: React.FC<SavingsCardProps> = ({ group, onContribute }) => {
  const [loading, setLoading] = useState(false);
  
  const handleContribution = useCallback(async (amount: number) => {
    setLoading(true);
    try {
      await onContribute(amount);
    } catch (error) {
      console.error('Contribution failed:', error);
    } finally {
      setLoading(false);
    }
  }, [onContribute]);

  return (
    <Card>
      {/* Component JSX */}
    </Card>
  );
};
```

### Styling

- Use Tailwind CSS for styling
- Follow mobile-first approach
- Use semantic class names
- Maintain consistent spacing

```tsx
// Good
<div className="flex flex-col space-y-4 p-6 bg-white rounded-lg shadow-md">
  <h2 className="text-xl font-semibold text-gray-900">
    Chama Details
  </h2>
</div>
```

### State Management

- Use React Query for server state
- Use local component state for UI state
- Use context sparingly for global state

```typescript
// Good - Server state with React Query
const { data: groups, isLoading } = useQuery({
  queryKey: ['chama-groups', userId],
  queryFn: () => fetchUserGroups(userId),
  enabled: !!userId
});

// Good - Local UI state
const [showModal, setShowModal] = useState(false);
```

## 🧪 Testing Guidelines

### Testing Strategy

- **Unit Tests**: Individual functions and components
- **Integration Tests**: Component interactions
- **E2E Tests**: Complete user workflows (planned)

### Writing Tests

```typescript
// Component test example
import { render, screen, fireEvent } from '@testing-library/react';
import { SavingsCard } from './SavingsCard';

describe('SavingsCard', () => {
  it('should display group information', () => {
    const mockGroup = {
      id: '1',
      name: 'Test Chama',
      currentAmount: 10000,
      targetAmount: 50000
    };

    render(<SavingsCard group={mockGroup} onContribute={jest.fn()} />);
    
    expect(screen.getByText('Test Chama')).toBeInTheDocument();
    expect(screen.getByText('KSh 10,000')).toBeInTheDocument();
  });
});
```

### Test Commands

```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

## 📚 Documentation

### Code Documentation

- Write clear, descriptive comments
- Document complex business logic
- Use JSDoc for functions and components

```typescript
/**
 * Calculates the monthly payment for a loan based on principal, interest rate, and term
 * @param principal - The loan amount in KSh
 * @param annualRate - Annual interest rate as a percentage (e.g., 5 for 5%)
 * @param termMonths - Loan term in months
 * @returns Monthly payment amount in KSh
 */
const calculateMonthlyPayment = (
  principal: number,
  annualRate: number,
  termMonths: number
): number => {
  // Implementation
};
```

### README Updates

When adding new features:

- Update feature list
- Add configuration instructions
- Include usage examples
- Update screenshots if needed

## 🌍 Community

### Communication Channels

- **GitHub Issues**: Bug reports and feature requests
- **GitHub Discussions**: General questions and ideas
- **Email**: <technical@chamalink.co.ke> for sensitive issues

### Getting Help

1. **Search Existing Issues**: Check if your question was already answered
2. **Read Documentation**: Review README and code comments
3. **Ask Questions**: Create a discussion or issue
4. **Join Community**: Engage with other contributors

### Recognition

We believe in recognizing contributions:

- Contributors are listed in our README
- Significant contributions are highlighted in release notes
- Active contributors may be invited to become maintainers

## 📋 Issue Templates

### Bug Report

```markdown
**Describe the bug**
A clear description of the bug

**To Reproduce**
Steps to reproduce the behavior

**Expected behavior**
What you expected to happen

**Screenshots**
If applicable, add screenshots

**Environment**
- OS: [e.g. Ubuntu 20.04]
- Browser: [e.g. Chrome 96]
- Node.js version: [e.g. 18.1.0]
```

### Feature Request

```markdown
**Is your feature request related to a problem?**
A clear description of the problem

**Describe the solution you'd like**
A clear description of your proposed solution

**Describe alternatives you've considered**
Alternative solutions or features you've considered

**Additional context**
Any other context about the feature request
```

## 🚀 Release Process

### Version Numbering

We follow [Semantic Versioning](https://semver.org/):

- `MAJOR.MINOR.PATCH`
- `MAJOR` - Breaking changes
- `MINOR` - New features (backward compatible)
- `PATCH` - Bug fixes (backward compatible)

### Release Checklist

- [ ] All tests passing
- [ ] Documentation updated
- [ ] Version bumped
- [ ] Changelog updated
- [ ] Security review completed
- [ ] Performance impact assessed

---

Thank you for contributing to ChamaLink! Together, we're building a better financial future for chama communities in Kenya. 🇰🇪

For questions about contributing, please reach out to our team at <technical@chamalink.co.ke> or create a discussion on GitHub.
