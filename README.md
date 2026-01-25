# Chat App

A real-time chat application built with React, TypeScript, and Supabase featuring instant messaging, online presence, and seamless real-time synchronization.

![Chat App](https://img.shields.io/badge/status-active-success.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)
![React](https://img.shields.io/badge/React-19-blue.svg)
![Supabase](https://img.shields.io/badge/Supabase-realtime-green.svg)

## ✨ Features

- 🔐 **Authentication** - Secure login and registration with Supabase Auth
- 💬 **Real-time Messaging** - Instant message delivery using Supabase Realtime
- 👥 **1:1 & Group Chats** - Direct messaging and group conversations
- 🟢 **Online Presence** - See who's currently online
- 🔔 **Unread Counts** - Badge notifications for unread messages
- ⚡ **Optimistic UI** - Messages appear instantly before server confirmation
- 📱 **Responsive Design** - Works seamlessly on desktop and mobile
- 🌐 **Connection Handling** - Auto-reconnection with retry logic

## 🏗️ Tech Stack

- **Frontend:** React 19, TypeScript, Zustand (state management)
- **Backend:** Supabase (PostgreSQL + Realtime + Auth)
- **Styling:** CSS (custom)
- **Build Tool:** Vite
- **Testing:** Playwright (e2e), Vitest (unit)
- **Linting:** ESLint

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd chat-app
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env` file in the root directory:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

To get these values:
1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Create a new project or select existing
3. Go to Settings → API
4. Copy the Project URL and anon/public key

### 4. Set up the database

Run the SQL migrations in order from `supabase/migrations/`:

1. Connect to your Supabase project's SQL Editor
2. Run each migration file in order (001, 002, 003, etc.)

Or use Supabase CLI:

```bash
npx supabase db push
```

### 5. Seed test data (optional)

```bash
# Run seed_test_user.sql in Supabase SQL Editor
# This creates a test user for development
```

### 6. Start the development server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## 🧪 Testing

### E2E Tests (Playwright)

```bash
# Run all e2e tests
npm run test:e2e

# Run e2e tests in UI mode (recommended)
npm run test:e2e:ui

# Run e2e tests in debug mode
npm run test:e2e:debug
```

**E2E Test Setup:**

Create `.env.e2e` for test credentials:

```env
E2E_TEST_EMAIL=test@example.com
E2E_TEST_PASSWORD=testpassword123
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### Unit Tests (Vitest)

```bash
npm run test:unit
npm run test:unit:watch  # Watch mode
npm run test:unit:coverage  # With coverage
```

## 📁 Project Structure

```
chat-app/
├── src/
│   ├── components/        # Reusable UI components
│   │   └── Toast/        # Toast notification system
│   ├── features/         # Feature-based modules
│   │   ├── auth/         # Authentication (login, register)
│   │   └── chat/         # Chat features
│   │       ├── ChatDashboard.tsx    # Main chat layout
│   │       ├── ChatWindow.tsx       # Message display
│   │       ├── ConversationList.tsx # Sidebar with conversations
│   │       └── MessageInput.tsx     # Message composer
│   ├── hooks/            # Custom React hooks
│   │   ├── useConnectionState.ts     # WebSocket connection handling
│   │   ├── usePresence.ts            # Online presence tracking
│   │   ├── useRealtimeMessages.ts    # Real-time message subscriptions
│   │   └── useRealtimeConversations.ts
│   ├── stores/           # Zustand state management
│   │   ├── chatStore.ts       # Messages + conversations
│   │   └── presenceStore.ts   # Online users
│   ├── types/            # TypeScript type definitions
│   ├── lib/              # Utilities
│   │   └── supabase.ts   # Supabase client setup
│   ├── App.tsx           # Root component
│   └── main.tsx          # Entry point
├── e2e/                  # Playwright e2e tests
│   ├── auth.spec.ts      # Authentication tests
│   ├── chat.spec.ts      # Chat dashboard tests
│   └── messaging.spec.ts # Messaging flow tests
├── supabase/
│   ├── migrations/       # Database schema migrations
│   └── seed_test_user.sql
├── public/               # Static assets
└── playwright.config.ts  # E2E test configuration
```

## 🗄️ Database Schema

### Core Tables

- **users** - User profiles (extends auth.users)
- **conversations** - Chat conversations (1:1 or group)
- **conversation_participants** - Links users to conversations
- **messages** - Chat messages
- **message_receipts** - Read/delivery status (schema exists, not yet implemented)

### Key Features

- **Real-time subscriptions** enabled on messages and conversations
- **Row Level Security (RLS)** policies for data access control
- **Soft deletes** for conversations (left_at timestamp)
- **Optimistic IDs** supported (temp- prefix for instant UI updates)

## 🔒 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_SUPABASE_URL` | Your Supabase project URL | Yes |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key | Yes |
| `E2E_TEST_EMAIL` | Test user email for e2e tests | For testing |
| `E2E_TEST_PASSWORD` | Test user password for e2e tests | For testing |

## 🐛 Known Issues / Limitations

- No pagination for messages (loads entire history)
- No file/image sharing
- No message editing or deletion
- No typing indicators
- No read receipts (schema exists but not implemented)
- No offline support

See `.agent/recommendations/missing-features.md` for full feature roadmap.

## 🚧 Development Guidelines

### Adding New Features

**Per our testing requirements**, all new features MUST include tests:

1. Create feature branch
2. Write test descriptions (can use `test.skip()` initially)
3. Implement feature
4. Complete test implementations
5. Verify tests pass: `npm run test:e2e && npm run test:unit`
6. Submit PR

See `.agent/rules/testing-requirements.md` for details.

### Code Style

- Use TypeScript strict mode
- Follow ESLint rules
- Use functional components with hooks
- Prefer const over let
- Use meaningful variable names

## 📚 Architecture

### State Management

- **Zustand** for global state (messages, conversations, presence)
- Local component state with `useState` for UI-only state
- No Redux - keeping it simple

### Real-time Communication

```typescript
// Supabase Realtime channels
- messages:INSERT        → New message received
- messages:UPDATE        → Message edited
- conversations:*        → Conversation changes
- presence:sync          → Online status updates
```

### Authentication Flow

1. User logs in via Supabase Auth
2. Session stored in localStorage
3. Auth state managed by `useAuth` hook
4. Protected routes redirect unauthenticated users

## 🔧 Troubleshooting

### Messages not appearing in real-time

1. Check Supabase Realtime is enabled:
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE messages;
   ```

2. Verify RLS policies allow SELECT for authenticated users

### Connection keeps disconnecting

- Check WebSocket connection limits in Supabase dashboard
- Review connection retry logic in `useConnectionState.ts`

### Tests failing

- Ensure `.env.e2e` has valid credentials
- Check test user exists in database
- Run `npx playwright install` to install browsers

## 📝 Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm run preview          # Preview production build
npm run lint             # Run ESLint
npm run test:e2e         # Run e2e tests
npm run test:e2e:ui      # Run e2e tests in UI mode
npm run test:unit        # Run unit tests (when added)
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. **Write tests for your feature** (see testing requirements)
4. Commit changes (`git commit -m 'Add amazing feature'`)
5. Push to branch (`git push origin feature/amazing-feature`)
6. Open Pull Request

## 📄 License

This project is for educational purposes.

## 🙏 Acknowledgments

- [Supabase](https://supabase.com) for backend infrastructure
- [Playwright](https://playwright.dev) for e2e testing
- [Zustand](https://github.com/pmndrs/zustand) for state management

---

**Need help?** Check the docs in `.agent/` or open an issue.
