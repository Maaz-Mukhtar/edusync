import { PrismaClient, UserRole, AttendanceStatus, AssessmentType, FeeFrequency, EventType, ApprovalStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hash } from "bcryptjs";
import "dotenv/config";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting seed...");

  // Clean up existing data
  await prisma.eventApproval.deleteMany();
  await prisma.event.deleteMany();
  await prisma.studentInsight.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.feeInvoice.deleteMany();
  await prisma.feeStructure.deleteMany();
  await prisma.assessmentResult.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.timetableSlot.deleteMany();
  await prisma.teacherSubject.deleteMany();
  await prisma.sectionTeacher.deleteMany();
  await prisma.parentStudent.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.teacherProfile.deleteMany();
  await prisma.parentProfile.deleteMany();
  await prisma.term.deleteMany();
  await prisma.academicYear.deleteMany();
  await prisma.section.deleteMany();
  await prisma.class.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.verificationToken.deleteMany();
  await prisma.user.deleteMany();
  await prisma.school.deleteMany();

  console.log("Cleaned up existing data");

  // Create demo school
  const school = await prisma.school.create({
    data: {
      name: "City Grammar School",
      subdomain: "demo",
      address: "123 Education Street, Lahore",
      phone: "+92-42-1234567",
      email: "info@citygrammar.edu.pk",
      settings: {
        timezone: "Asia/Karachi",
        currency: "PKR",
        language: "en",
      },
    },
  });
  console.log(`Created school: ${school.name}`);

  // Hash password (same for all demo users)
  const passwordHash = await hash("password123", 10);

  // Create Admin User
  const adminUser = await prisma.user.create({
    data: {
      schoolId: school.id,
      email: "admin@citygrammar.edu.pk",
      phone: "03001234567",
      passwordHash,
      role: UserRole.ADMIN,
      firstName: "Ahmed",
      lastName: "Khan",
    },
  });
  console.log(`Created admin: ${adminUser.email}`);

  // Create Academic Year
  const academicYear = await prisma.academicYear.create({
    data: {
      schoolId: school.id,
      name: "2024-2025",
      startDate: new Date("2024-04-01"),
      endDate: new Date("2025-03-31"),
      isCurrent: true,
    },
  });

  // Create Terms
  const term1 = await prisma.term.create({
    data: {
      academicYearId: academicYear.id,
      name: "Term 1",
      startDate: new Date("2024-04-01"),
      endDate: new Date("2024-08-31"),
    },
  });

  const term2 = await prisma.term.create({
    data: {
      academicYearId: academicYear.id,
      name: "Term 2",
      startDate: new Date("2024-09-01"),
      endDate: new Date("2025-03-31"),
    },
  });

  // Create Subjects
  const subjects = await Promise.all([
    prisma.subject.create({
      data: { schoolId: school.id, name: "Mathematics", code: "MATH", color: "#3B82F6" },
    }),
    prisma.subject.create({
      data: { schoolId: school.id, name: "English", code: "ENG", color: "#10B981" },
    }),
    prisma.subject.create({
      data: { schoolId: school.id, name: "Science", code: "SCI", color: "#8B5CF6" },
    }),
    prisma.subject.create({
      data: { schoolId: school.id, name: "Urdu", code: "URD", color: "#F59E0B" },
    }),
    prisma.subject.create({
      data: { schoolId: school.id, name: "Islamiat", code: "ISL", color: "#EF4444" },
    }),
    prisma.subject.create({
      data: { schoolId: school.id, name: "Computer Science", code: "CS", color: "#06B6D4" },
    }),
  ]);
  console.log(`Created ${subjects.length} subjects`);

  // Create Classes and Sections
  const classes = await Promise.all([
    prisma.class.create({
      data: {
        schoolId: school.id,
        name: "Grade 6",
        displayOrder: 1,
        sections: {
          create: [
            { name: "A", capacity: 30 },
            { name: "B", capacity: 30 },
          ],
        },
      },
      include: { sections: true },
    }),
    prisma.class.create({
      data: {
        schoolId: school.id,
        name: "Grade 7",
        displayOrder: 2,
        sections: {
          create: [
            { name: "A", capacity: 30 },
            { name: "B", capacity: 30 },
          ],
        },
      },
      include: { sections: true },
    }),
    prisma.class.create({
      data: {
        schoolId: school.id,
        name: "Grade 8",
        displayOrder: 3,
        sections: {
          create: [
            { name: "A", capacity: 30 },
            { name: "B", capacity: 30 },
          ],
        },
      },
      include: { sections: true },
    }),
  ]);
  console.log(`Created ${classes.length} classes with sections`);

  // Create Teachers
  const teacherData = [
    { firstName: "Fatima", lastName: "Ali", email: "fatima.ali@citygrammar.edu.pk", phone: "03011111111" },
    { firstName: "Hassan", lastName: "Raza", email: "hassan.raza@citygrammar.edu.pk", phone: "03022222222" },
    { firstName: "Ayesha", lastName: "Malik", email: "ayesha.malik@citygrammar.edu.pk", phone: "03033333333" },
  ];

  const teachers = await Promise.all(
    teacherData.map(async (data, index) => {
      const user = await prisma.user.create({
        data: {
          schoolId: school.id,
          ...data,
          passwordHash,
          role: UserRole.TEACHER,
        },
      });

      const profile = await prisma.teacherProfile.create({
        data: {
          userId: user.id,
          employeeId: `T${String(index + 1).padStart(3, "0")}`,
          qualification: "M.Ed",
          joinDate: new Date("2020-01-15"),
        },
      });

      return { user, profile };
    })
  );
  console.log(`Created ${teachers.length} teachers`);

  // Assign teachers to sections and subjects
  for (const cls of classes) {
    for (const section of cls.sections) {
      // Assign first teacher as class teacher
      await prisma.sectionTeacher.create({
        data: {
          sectionId: section.id,
          teacherId: teachers[0].profile.id,
          isClassTeacher: true,
        },
      });

      // Assign other teachers
      for (let i = 1; i < teachers.length; i++) {
        await prisma.sectionTeacher.create({
          data: {
            sectionId: section.id,
            teacherId: teachers[i].profile.id,
          },
        });
      }
    }
  }

  // Assign subjects to teachers
  for (let i = 0; i < teachers.length; i++) {
    await prisma.teacherSubject.create({
      data: {
        teacherId: teachers[i].profile.id,
        subjectId: subjects[i * 2].id,
      },
    });
    await prisma.teacherSubject.create({
      data: {
        teacherId: teachers[i].profile.id,
        subjectId: subjects[i * 2 + 1].id,
      },
    });
  }

  // Create Students and Parents
  const studentNames = [
    { firstName: "Ali", lastName: "Ahmad" },
    { firstName: "Sara", lastName: "Khan" },
    { firstName: "Bilal", lastName: "Hassan" },
    { firstName: "Zara", lastName: "Malik" },
    { firstName: "Omar", lastName: "Sheikh" },
    { firstName: "Hina", lastName: "Akhtar" },
    { firstName: "Usman", lastName: "Farooq" },
    { firstName: "Maryam", lastName: "Javed" },
    { firstName: "Hamza", lastName: "Qureshi" },
    { firstName: "Amna", lastName: "Riaz" },
  ];

  const students = [];
  const parents = [];

  for (let i = 0; i < studentNames.length; i++) {
    const sectionIndex = i % classes[0].sections.length;
    const classIndex = Math.floor(i / 4) % classes.length;
    const section = classes[classIndex].sections[sectionIndex];

    // Create student user
    const studentUser = await prisma.user.create({
      data: {
        schoolId: school.id,
        email: `${studentNames[i].firstName.toLowerCase()}.${studentNames[i].lastName.toLowerCase()}@student.citygrammar.edu.pk`,
        phone: `030${String(40000000 + i)}`,
        passwordHash,
        role: UserRole.STUDENT,
        ...studentNames[i],
      },
    });

    // Create student profile
    const studentProfile = await prisma.studentProfile.create({
      data: {
        userId: studentUser.id,
        sectionId: section.id,
        rollNumber: `${classIndex + 6}${String(sectionIndex + 1)}${String(i + 1).padStart(2, "0")}`,
        dateOfBirth: new Date(2012 - classIndex, i % 12, (i % 28) + 1),
        admissionDate: new Date("2023-04-01"),
      },
    });

    students.push({ user: studentUser, profile: studentProfile });

    // Create parent user (one parent per student for simplicity)
    const parentUser = await prisma.user.create({
      data: {
        schoolId: school.id,
        email: `parent.${studentNames[i].lastName.toLowerCase()}${i}@gmail.com`,
        phone: `030${String(50000000 + i)}`,
        passwordHash,
        role: UserRole.PARENT,
        firstName: `Mr. ${studentNames[i].lastName}`,
        lastName: "(Parent)",
      },
    });

    const parentProfile = await prisma.parentProfile.create({
      data: {
        userId: parentUser.id,
        occupation: "Business",
        relationship: "Father",
      },
    });

    // Link parent to student
    await prisma.parentStudent.create({
      data: {
        parentId: parentProfile.id,
        studentId: studentProfile.id,
      },
    });

    parents.push({ user: parentUser, profile: parentProfile });
  }
  console.log(`Created ${students.length} students and ${parents.length} parents`);

  // Create Fee Structures
  const feeStructures = await Promise.all([
    prisma.feeStructure.create({
      data: {
        schoolId: school.id,
        name: "Monthly Tuition Fee",
        amount: 15000,
        frequency: FeeFrequency.MONTHLY,
        dueDay: 10,
      },
    }),
    prisma.feeStructure.create({
      data: {
        schoolId: school.id,
        name: "Annual Registration Fee",
        amount: 25000,
        frequency: FeeFrequency.ANNUAL,
      },
    }),
    prisma.feeStructure.create({
      data: {
        schoolId: school.id,
        name: "Computer Lab Fee",
        amount: 3000,
        frequency: FeeFrequency.QUARTERLY,
      },
    }),
  ]);
  console.log(`Created ${feeStructures.length} fee structures`);

  // Create some fee invoices
  for (const student of students.slice(0, 5)) {
    await prisma.feeInvoice.create({
      data: {
        studentId: student.profile.id,
        feeStructureId: feeStructures[0].id,
        amount: feeStructures[0].amount,
        dueDate: new Date("2025-01-10"),
        status: "PENDING",
      },
    });
  }
  console.log("Created sample fee invoices");

  // Create Assessments and Results
  const assessment = await prisma.assessment.create({
    data: {
      sectionId: classes[0].sections[0].id,
      subjectId: subjects[0].id,
      termId: term1.id,
      createdById: teachers[0].profile.id,
      title: "Mid-Term Mathematics Test",
      type: AssessmentType.TEST,
      totalMarks: 100,
      date: new Date("2024-10-15"),
      topics: ["Algebra", "Geometry", "Fractions"],
      description: "Covers chapters 1-5",
    },
  });

  // Add results for students in that section
  const sectionStudents = students.filter(
    (s) => s.profile.sectionId === classes[0].sections[0].id
  );

  for (const student of sectionStudents) {
    const marks = Math.floor(Math.random() * 40) + 60; // Random score between 60-100
    await prisma.assessmentResult.create({
      data: {
        assessmentId: assessment.id,
        studentId: student.profile.id,
        marksObtained: marks,
        grade: marks >= 90 ? "A+" : marks >= 80 ? "A" : marks >= 70 ? "B" : "C",
        topicScores: {
          Algebra: Math.floor(marks * 0.35),
          Geometry: Math.floor(marks * 0.35),
          Fractions: Math.floor(marks * 0.3),
        },
      },
    });
  }
  console.log("Created assessment with results");

  // Create some attendance records
  const today = new Date();
  for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() - dayOffset);

    // Skip weekends
    if (date.getDay() === 0 || date.getDay() === 6) continue;

    for (const student of students) {
      const statuses: AttendanceStatus[] = ["PRESENT", "PRESENT", "PRESENT", "PRESENT", "LATE", "ABSENT"];
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];

      await prisma.attendance.create({
        data: {
          studentId: student.profile.id,
          sectionId: student.profile.sectionId,
          date,
          status: randomStatus,
          markedBy: teachers[0].profile.id,
        },
      });
    }
  }
  console.log("Created attendance records");

  // Create an announcement
  await prisma.announcement.create({
    data: {
      schoolId: school.id,
      title: "Welcome to the New Academic Year!",
      content:
        "Dear students and parents, welcome to the new academic year 2024-2025. We are excited to have you with us and look forward to a year of learning and growth.",
      audience: ["all"],
      priority: "high",
      createdBy: adminUser.id,
      publishAt: new Date(),
    },
  });
  console.log("Created announcement");

  // Create Events for testing
  const now = new Date();

  // Event 1: Urgent trip (deadline in 1 day)
  const urgentTrip = await prisma.event.create({
    data: {
      schoolId: school.id,
      title: "Science Museum Field Trip",
      description: "Educational visit to the National Science Museum. Students will explore exhibits on physics, biology, and technology. Lunch will be provided.",
      type: EventType.TRIP,
      location: "National Science Museum, Lahore",
      startDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      endDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      fee: 1500,
      capacity: 50,
      deadline: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), // 1 day from now (URGENT)
      targetAudience: ["Grade 6", "Grade 7"],
      requiresApproval: true,
      createdBy: adminUser.id,
    },
  });

  // Event 2: Regular event (deadline in 5 days)
  const sportsDay = await prisma.event.create({
    data: {
      schoolId: school.id,
      title: "Annual Sports Day",
      description: "Join us for our annual sports day celebration! Various athletic events, team competitions, and prizes await. Parents are welcome to attend.",
      type: EventType.EVENT,
      location: "School Sports Ground",
      startDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      endDate: new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000),
      fee: null, // Free event
      capacity: 200,
      deadline: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      targetAudience: ["All Grades"],
      requiresApproval: true,
      createdBy: adminUser.id,
    },
  });

  // Event 3: Workshop with fee
  const codingWorkshop = await prisma.event.create({
    data: {
      schoolId: school.id,
      title: "Coding & Robotics Workshop",
      description: "Two-day hands-on workshop on Python programming and basic robotics. Students will build and program their own simple robots.",
      type: EventType.WORKSHOP,
      location: "Computer Lab, Block A",
      startDate: new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000), // 21 days from now
      endDate: new Date(now.getTime() + 22 * 24 * 60 * 60 * 1000), // 2-day event
      fee: 3000,
      capacity: 30,
      deadline: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      targetAudience: ["Grade 7", "Grade 8"],
      requiresApproval: true,
      createdBy: adminUser.id,
    },
  });

  // Event 4: Competition
  const mathOlympiad = await prisma.event.create({
    data: {
      schoolId: school.id,
      title: "Inter-School Math Olympiad",
      description: "Represent our school in the regional Mathematics Olympiad competition. Selected students will compete against other schools.",
      type: EventType.COMPETITION,
      location: "City Convention Center",
      startDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000), // 30 days from now
      endDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
      fee: 500,
      capacity: 20,
      deadline: new Date(now.getTime() + 15 * 24 * 60 * 60 * 1000), // 15 days from now
      targetAudience: ["Grade 6", "Grade 7", "Grade 8"],
      requiresApproval: true,
      createdBy: adminUser.id,
    },
  });

  // Event 5: Past event (already happened)
  const pastEvent = await prisma.event.create({
    data: {
      schoolId: school.id,
      title: "Cultural Day Celebration",
      description: "Students showcased cultural performances and traditional dress from various regions.",
      type: EventType.ACTIVITY,
      location: "School Auditorium",
      startDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
      endDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      fee: null,
      capacity: 100,
      deadline: new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000), // 21 days ago
      targetAudience: ["All Grades"],
      requiresApproval: true,
      createdBy: adminUser.id,
    },
  });

  console.log("Created 5 events");

  // Create Event Approvals for parents
  // We'll create various approval statuses to test different scenarios

  // Get all parent-student relationships
  const parentStudentLinks = await prisma.parentStudent.findMany({
    include: {
      parent: true,
      student: true,
    },
  });

  for (const link of parentStudentLinks) {
    const studentIndex = students.findIndex(s => s.profile.id === link.studentId);

    // Event 1 (Urgent Trip): Mix of pending and some approved
    if (studentIndex < 6) { // First 6 students
      await prisma.eventApproval.create({
        data: {
          eventId: urgentTrip.id,
          studentId: link.studentId,
          parentId: link.parentId,
          status: studentIndex < 3 ? ApprovalStatus.PENDING : ApprovalStatus.APPROVED,
          remarks: studentIndex >= 3 ? "Looking forward to this educational trip!" : null,
          respondedAt: studentIndex >= 3 ? new Date() : null,
        },
      });
    }

    // Event 2 (Sports Day): All pending for testing
    await prisma.eventApproval.create({
      data: {
        eventId: sportsDay.id,
        studentId: link.studentId,
        parentId: link.parentId,
        status: ApprovalStatus.PENDING,
      },
    });

    // Event 3 (Workshop): Some pending, some approved, some declined
    if (studentIndex < 8) {
      await prisma.eventApproval.create({
        data: {
          eventId: codingWorkshop.id,
          studentId: link.studentId,
          parentId: link.parentId,
          status: studentIndex < 4
            ? ApprovalStatus.PENDING
            : studentIndex < 6
              ? ApprovalStatus.APPROVED
              : ApprovalStatus.DECLINED,
          remarks: studentIndex >= 6 ? "Unable to attend due to prior commitment." :
                   studentIndex >= 4 ? "Excited about robotics!" : null,
          respondedAt: studentIndex >= 4 ? new Date() : null,
        },
      });
    }

    // Event 4 (Math Olympiad): First 5 students only, all pending
    if (studentIndex < 5) {
      await prisma.eventApproval.create({
        data: {
          eventId: mathOlympiad.id,
          studentId: link.studentId,
          parentId: link.parentId,
          status: ApprovalStatus.PENDING,
        },
      });
    }

    // Event 5 (Past Event): All approved (historical data)
    await prisma.eventApproval.create({
      data: {
        eventId: pastEvent.id,
        studentId: link.studentId,
        parentId: link.parentId,
        status: ApprovalStatus.APPROVED,
        remarks: "Thank you for organizing this wonderful event!",
        respondedAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log("Created event approvals for all parent-student pairs");

  console.log("\n✅ Seed completed successfully!");
  console.log("\n📋 Demo Login Credentials:");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("School Subdomain: demo");
  console.log("Password (all users): password123");
  console.log("\nAdmin: admin@citygrammar.edu.pk");
  console.log("Teacher: fatima.ali@citygrammar.edu.pk");
  console.log("Student: ali.ahmad@student.citygrammar.edu.pk");
  console.log("Parent: parent.ahmad0@gmail.com");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
