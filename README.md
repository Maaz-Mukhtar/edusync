# EduSync - School Management System

A modern, multi-tenant SaaS platform for managing Pakistani schools. Built with Next.js 16, featuring role-based access control, fee management, and comprehensive administrative tools.

![Next.js](https://img.shields.io/badge/Next.js-16.1.1-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript)
![Prisma](https://img.shields.io/badge/Prisma-7.0-2D3748?style=flat-square&logo=prisma)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.0-38B2AC?style=flat-square&logo=tailwind-css)

## Features

### Authentication & Authorization
- Secure authentication with NextAuth v5
- Role-based access control (Super Admin, Admin, Teacher, Student, Parent)
- Multi-tenant architecture with school-based data isolation

### Admin Portal
- **User Management** - Full CRUD for all user roles with role-specific profiles
- **Class & Section Management** - Organize students into classes and sections
- **Subject Management** - Manage subjects with color coding
- **Parent-Student Linking** - Connect parents to their children
- **Fee Management** - Configure fee structures (Monthly, Quarterly, Annual)
- **Invoice Generation** - Bulk generate and track fee invoices
- **CSV Bulk Import** - Import multiple users via CSV upload
- **Dashboard** - Real-time statistics and insights

### Coming Soon
- Teacher Portal (Attendance, Gradebook, Assessments)
- Student Portal (Timetable, Grades, Assignments)
- Parent Portal (Child progress, Fee payments)
- AI-powered insights and recommendations

## Tech Stack

| Category | Technology |
|----------|------------|
| Framework | Next.js 16.1.1 (App Router + Turbopack) |
| Language | TypeScript 5 |
| Database | PostgreSQL (Supabase) |
| ORM | Prisma 7 |
| Authentication | NextAuth v5 (Auth.js) |
| Styling | Tailwind CSS 4 |
| UI Components | shadcn/ui |
| Validation | Zod |
| Tables | TanStack React Table |

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL database (or Supabase account)
- pnpm, npm, or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Maaz-Mukhtar/edusync.git
   cd edusync
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   ```

   Update `.env` with your values:
   ```env
   # Database (Supabase PostgreSQL)
   DATABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres"

   # NextAuth
   AUTH_SECRET="your-secret-key-here"
   AUTH_URL="http://localhost:3000"

   # App
   NEXT_PUBLIC_APP_URL="http://localhost:3000"
   ```

4. **Push database schema**
   ```bash
   npm run db:push
   ```

5. **Seed demo data**
   ```bash
   npm run db:seed
   ```

6. **Start development server**
   ```bash
   npm run dev
   ```

7. **Open in browser**
   ```
   http://localhost:3000
   ```

## Demo Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@citygrammar.edu.pk | password123 |
| Teacher | fatima.ali@citygrammar.edu.pk | password123 |
| Student | ali.ahmed@student.citygrammar.edu.pk | password123 |
| Parent | parent.ahmed0@gmail.com | password123 |

## Project Structure

```
edusync/
├── prisma/
│   ├── schema.prisma      # Database schema
│   └── seed.ts            # Demo data seeder
├── src/
│   ├── app/
│   │   ├── (auth)/        # Authentication pages
│   │   ├── (dashboard)/   # Dashboard pages by role
│   │   │   ├── admin/     # Admin portal
│   │   │   ├── teacher/   # Teacher portal
│   │   │   ├── student/   # Student portal
│   │   │   └── parent/    # Parent portal
│   │   └── api/           # API routes
│   ├── components/
│   │   ├── layout/        # Layout components
│   │   └── ui/            # shadcn/ui components
│   └── lib/
│       ├── auth.ts        # NextAuth configuration
│       ├── prisma.ts      # Prisma client
│       └── utils.ts       # Utility functions
├── .env.example           # Environment template
└── package.json
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server with Turbopack |
| `npm run build` | Build for production |
| `npm run start` | Start production server |
| `npm run lint` | Run ESLint |
| `npm run db:push` | Push Prisma schema to database |
| `npm run db:seed` | Seed database with demo data |
| `npm run db:studio` | Open Prisma Studio |

## Database Schema

### Core Models
- **School** - Multi-tenant school organization
- **User** - All users with role-based profiles
- **StudentProfile** - Student-specific data
- **TeacherProfile** - Teacher-specific data
- **ParentProfile** - Parent-specific data

### Academic Models
- **Class** - Grade levels (e.g., Class 1, Class 2)
- **Section** - Divisions within classes (e.g., A, B, C)
- **Subject** - Academic subjects
- **AcademicYear** - School years with terms

### Financial Models
- **FeeStructure** - Fee types and amounts
- **FeeInvoice** - Generated invoices with payment tracking

## API Routes

### Users
- `GET /api/users` - List users with filtering
- `POST /api/users` - Create user
- `GET /api/users/[id]` - Get user details
- `PUT /api/users/[id]` - Update user
- `DELETE /api/users/[id]` - Delete user
- `POST /api/users/import` - Bulk import from CSV

### Classes & Sections
- `GET /api/classes` - List classes
- `POST /api/classes` - Create class
- `POST /api/classes/[id]/sections` - Add section
- `GET /api/sections` - List sections

### Subjects
- `GET /api/subjects` - List subjects
- `POST /api/subjects` - Create subject

### Fee Management
- `GET /api/fee-structures` - List fee structures
- `POST /api/fee-structures` - Create fee structure
- `GET /api/invoices` - List invoices
- `POST /api/invoices` - Create invoice
- `PUT /api/invoices` - Bulk generate invoices

## Development Roadmap

### Completed
- [x] Sprint 1: Foundation (Auth, Database, Base UI)
- [x] Sprint 2: Admin Portal (User, Class, Fee Management)

### In Progress
- [ ] Sprint 3: Teacher Portal (Attendance, Gradebook)
- [ ] Sprint 4: Student & Parent Portals
- [ ] Sprint 5: AI Integration & Analytics

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Next.js](https://nextjs.org/) - The React Framework
- [Prisma](https://www.prisma.io/) - Next-generation ORM
- [shadcn/ui](https://ui.shadcn.com/) - Beautiful UI components
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS
- [Supabase](https://supabase.com/) - Open source Firebase alternative

---

Built with Claude Code by [Maaz Mukhtar](https://github.com/Maaz-Mukhtar)
