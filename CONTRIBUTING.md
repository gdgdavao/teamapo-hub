# Contributing to TeamApo Hub

Thank you for your interest in contributing to TeamApo Hub! This document provides guidelines and information about contributing to the GDG Davao event management platform.

## 📋 Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Process](#development-process)
- [Coding Guidelines](#coding-guidelines)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Community](#community)

## 🤝 Code of Conduct

### Our Pledge
We are committed to providing a friendly, safe, and welcoming environment for all contributors, regardless of experience level, gender identity and expression, sexual orientation, disability, personal appearance, body size, race, ethnicity, age, religion, or nationality.

### Our Standards

#### Positive Behavior
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

#### Unacceptable Behavior
- Trolling, insulting/derogatory comments, and personal attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate

### Enforcement
Project maintainers are responsible for clarifying standards of acceptable behavior and will take appropriate action in response to unacceptable behavior. Contact us at support@gdgdavao.org to report issues.

## 🚀 Getting Started

### Prerequisites
Before contributing, make sure you have:
- Read our [Development Guide](docs/DEVELOPMENT.md)
- Set up the development environment
- Familiarized yourself with the project structure
- Joined our community channels (Discord/Slack)

### First-Time Contributors
Looking for your first contribution? Check out issues labeled:
- `good-first-issue` - Perfect for newcomers
- `help-wanted` - Issues where we need community help
- `documentation` - Help improve our docs

## 🛠️ How to Contribute

### Types of Contributions

#### 🐛 Bug Reports
Help us improve by reporting bugs you encounter:
1. Search existing issues to avoid duplicates
2. Use our bug report template
3. Provide clear reproduction steps
4. Include environment details (OS, browser, etc.)

#### ✨ Feature Requests
Suggest new features or improvements:
1. Check if the feature is already planned
2. Use our feature request template
3. Explain the use case and benefits
4. Consider implementation complexity

#### 💻 Code Contributions
Contribute code improvements:
- Bug fixes
- New features
- Performance improvements
- Code refactoring
- Test coverage improvements

#### 📚 Documentation
Help improve our documentation:
- Fix typos and grammar
- Add missing documentation
- Improve code examples
- Translate documentation

#### 🎨 UI/UX Improvements
Enhance user experience:
- Design improvements
- Accessibility enhancements
- Mobile responsiveness
- User flow optimization

## 🔄 Development Process

### 1. Fork and Clone
```bash
# Fork the repository on GitHub
# Then clone your fork
git clone https://github.com/YOUR_USERNAME/teamapo-hub.git
cd teamapo-hub

# Add upstream remote
git remote add upstream https://github.com/gdgdavao/teamapo-hub.git
```

### 2. Create a Branch
```bash
# Create and checkout a new branch
git checkout -b feature/your-feature-name

# Keep your fork updated
git fetch upstream
git checkout main
git merge upstream/main
```

### 3. Make Changes
Follow our [coding guidelines](#coding-guidelines) and ensure:
- Code follows project conventions
- Tests pass (when applicable)
- Documentation is updated
- Commit messages are clear

### 4. Test Your Changes
```bash
# Run the development server
bun run dev

# Run linting
bun run lint

# Run tests (when available)
bun test
```

### 5. Commit and Push
```bash
# Stage your changes
git add .

# Commit with a descriptive message
git commit -m "feat(events): add event search functionality"

# Push to your fork
git push origin feature/your-feature-name
```

### 6. Create Pull Request
1. Go to your fork on GitHub
2. Click "New Pull Request"
3. Fill out the PR template
4. Wait for review and feedback

## 📏 Coding Guidelines

### TypeScript Standards
```typescript
// Use explicit types
interface EventFormData {
  title: string;
  description: string;
  date: Date;
  location: string;
  capacity: number;
}

// Prefer interfaces over types for objects
interface ComponentProps {
  event: Event;
  onUpdate: (event: Event) => void;
}

// Use union types for constants
type EventStatus = 'draft' | 'published' | 'cancelled';
```

### React Component Guidelines
```typescript
// Use functional components with TypeScript
interface EventCardProps {
  event: Event;
  className?: string;
  onEdit?: (id: string) => void;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  className = '',
  onEdit
}) => {
  // Group hooks at the top
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  
  // Event handlers
  const handleEdit = () => {
    onEdit?.(event.id);
  };

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Component JSX */}
    </div>
  );
};
```

### CSS/Styling Guidelines
```typescript
// Use Tailwind utility classes
const styles = {
  container: 'max-w-4xl mx-auto px-4 sm:px-6 lg:px-8',
  card: 'bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow',
  button: 'bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg'
};

// Group related classes
const buttonVariants = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-900',
  danger: 'bg-red-600 hover:bg-red-700 text-white'
};
```

### File and Folder Naming
- **Components**: `PascalCase.tsx` (e.g., `EventCard.tsx`)
- **Pages**: `PascalCase.tsx` with `Page` suffix (e.g., `EventDetailPage.tsx`)
- **Utilities**: `camelCase.ts` (e.g., `formatDate.ts`)
- **Constants**: `UPPER_SNAKE_CASE.ts` (e.g., `API_ENDPOINTS.ts`)

### Import Organization
```typescript
// React and external libraries
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';

// Internal utilities and configs
import { db } from '@/config/firebase';
import { formatDate } from '@/utils/formatDate';

// Components
import { Button } from '@/components/UI/Button';
import { LoadingSpinner } from '@/components/UI/LoadingSpinner';

// Types
import type { Event, User } from '@/types';
```

### Error Handling
```typescript
// Use try-catch for async operations
const handleEventCreation = async (eventData: EventFormData) => {
  try {
    setIsLoading(true);
    const event = await createEvent(eventData);
    toast.success('Event created successfully!');
    navigate(`/events/${event.id}`);
  } catch (error) {
    console.error('Failed to create event:', error);
    toast.error('Failed to create event. Please try again.');
  } finally {
    setIsLoading(false);
  }
};
```

## 🔄 Pull Request Process

### PR Requirements
Before submitting a pull request, ensure:
- [ ] Code follows project conventions
- [ ] All tests pass (when applicable)
- [ ] Documentation is updated
- [ ] PR description is clear and complete
- [ ] Related issues are linked

### PR Template
When creating a PR, include:

```markdown
## Description
Brief description of the changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] I have tested this change locally
- [ ] I have added tests that prove my fix is effective or that my feature works

## Screenshots (if applicable)
Add screenshots for UI changes

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented my code where necessary
- [ ] I have made corresponding changes to documentation
```

### Review Process
1. **Automated Checks**: CI/CD pipeline runs automatically
2. **Code Review**: Maintainers review your code
3. **Feedback**: Address any requested changes
4. **Approval**: Once approved, your PR will be merged

### After Your PR is Merged
1. Delete your feature branch
2. Pull the latest changes from main
3. Update your local repository

## 📝 Issue Guidelines

### Creating Good Issues

#### Bug Reports
```markdown
**Bug Description**
A clear description of what the bug is.

**Steps to Reproduce**
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected Behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment**
- OS: [e.g. iOS]
- Browser: [e.g. chrome, safari]
- Version: [e.g. 22]
```

#### Feature Requests
```markdown
**Feature Description**
A clear description of what you want to happen.

**Problem Statement**
Explain the problem this feature would solve.

**Proposed Solution**
Describe your proposed solution.

**Alternatives Considered**
Any alternative solutions you've considered.

**Additional Context**
Any other context or screenshots about the feature request.
```

### Issue Labels
We use labels to categorize issues:
- `bug` - Something isn't working
- `enhancement` - New feature or request
- `documentation` - Improvements or additions to documentation
- `good-first-issue` - Good for newcomers
- `help-wanted` - Extra attention is needed
- `question` - Further information is requested

## 🌟 Recognition

### Contributors
All contributors are recognized in our:
- README.md contributors section
- Annual GDG Davao community highlights
- GitHub contributors page

### Levels of Contribution
- **Contributor**: Made at least one merged contribution
- **Regular Contributor**: Multiple contributions over time
- **Core Contributor**: Significant ongoing contributions
- **Maintainer**: Trusted with merge access and project decisions

## 🎯 Community

### Communication Channels
- **GitHub Issues**: For bug reports and feature requests
- **GitHub Discussions**: For questions and community discussions
- **Discord**: Real-time chat with the community
- **Email**: support@gdgdavao.org for sensitive matters

### Community Guidelines
- Be respectful and professional
- Help newcomers learn and grow
- Share knowledge and best practices
- Give constructive feedback
- Celebrate others' contributions

### Events and Meetups
Join GDG Davao events to:
- Meet other contributors in person
- Learn new technologies
- Share your TeamApo Hub experience
- Network with the local tech community


## 📞 Need Help?

If you need help with contributing:
1. Check our [Development Guide](docs/DEVELOPMENT.md)
2. Search existing issues and discussions
3. Ask in our community channels
4. Email us at support@gdgdavao.org

## 📄 License

By contributing to TeamApo Hub, you agree that your contributions will be licensed under the same license as the project (MIT License).

---

Thank you for contributing to TeamApo Hub and helping make the GDG Davao community awesome!

**Happy Contributing!** 