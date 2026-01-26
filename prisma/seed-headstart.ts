import { PrismaClient, UserRole } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { hash } from "bcryptjs";
import "dotenv/config";

type SeedArgs = {
  subdomain: string;
  includePreClasses: boolean;
  sectionsPerClass: string[];
  studentsPerSection: number;
  purge: boolean;
};

const SUBJECTS_JUNIOR = [
  { name: "Mathematics", code: "MATH", color: "#3B82F6" },
  { name: "English", code: "ENG", color: "#10B981" },
  { name: "Science", code: "SCI", color: "#8B5CF6" },
  { name: "Urdu", code: "URD", color: "#F59E0B" },
];

const SUBJECTS_SENIOR = [
  ...SUBJECTS_JUNIOR,
  { name: "Islamiat", code: "ISL", color: "#EF4444" },
  { name: "Computer Science", code: "CS", color: "#06B6D4" },
];

function getArgValue(flag: string): string | null {
  const idx = process.argv.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (idx === -1) return null;
  const raw = process.argv[idx];
  if (raw.includes("=")) return raw.split("=").slice(1).join("=");
  return process.argv[idx + 1] ?? null;
}

function parseArgs(): SeedArgs {
  const subdomain = getArgValue("--subdomain") || "headstart";
  const includePreClasses = process.argv.includes("--include-pre");
  const purge = process.argv.includes("--purge");

  const studentsPerSectionRaw = getArgValue("--students-per-section");
  const studentsPerSection = studentsPerSectionRaw ? Number(studentsPerSectionRaw) : 10;
  if (!Number.isFinite(studentsPerSection) || studentsPerSection <= 0) {
    throw new Error("Invalid --students-per-section");
  }

  const sectionsRaw = getArgValue("--sections");
  const sectionsPerClass = (sectionsRaw ? sectionsRaw.split(",") : ["A", "B", "C"])
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    subdomain,
    includePreClasses,
    sectionsPerClass,
    studentsPerSection,
    purge,
  };
}

function currentAcademicYearName(now = new Date()): { name: string; startYear: number; endYear: number } {
  // Assume academic year starts Aug 1
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const startYear = month >= 7 ? year : year - 1;
  const endYear = startYear + 1;
  return { name: `${startYear}-${endYear}`, startYear, endYear };
}

function classDefinitions(includePre: boolean) {
  const defs: Array<{ key: string; name: string; displayOrder: number; grade: number | null }> = [];

  if (includePre) {
    defs.push(
      { key: "pre-nursery", name: "Pre-Nursery", displayOrder: 0, grade: null },
      { key: "nursery", name: "Nursery", displayOrder: 1, grade: null },
      { key: "kg", name: "KG", displayOrder: 2, grade: null },
      { key: "prep", name: "Prep", displayOrder: 3, grade: null }
    );
  }

  const base = includePre ? 4 : 0;
  for (let grade = 1; grade <= 8; grade++) {
    defs.push({
      key: `grade-${grade}`,
      name: `Grade ${grade}`,
      displayOrder: base + grade,
      grade,
    });
  }

  return defs;
}

function seedEmail(suffix: string, schoolDomain = "headstart.edupal.com") {
  return `seed.${suffix}@${schoolDomain}`.toLowerCase();
}

async function ensureTeacher(
  prisma: PrismaClient,
  params: {
    schoolId: string;
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
    employeeId: string;
  }
) {
  const user = await prisma.user.upsert({
    where: { schoolId_email: { schoolId: params.schoolId, email: params.email } },
    update: {
      phone: params.phone,
      firstName: params.firstName,
      lastName: params.lastName,
      role: UserRole.TEACHER,
      isActive: true,
      passwordHash: params.passwordHash,
    },
    create: {
      schoolId: params.schoolId,
      email: params.email,
      phone: params.phone,
      passwordHash: params.passwordHash,
      role: UserRole.TEACHER,
      firstName: params.firstName,
      lastName: params.lastName,
    },
  });

  const profile = await prisma.teacherProfile.upsert({
    where: { userId: user.id },
    update: { employeeId: params.employeeId },
    create: {
      userId: user.id,
      employeeId: params.employeeId,
      qualification: "B.Ed",
      joinDate: new Date(),
    },
  });

  return { user, profile };
}

async function ensureStudent(
  prisma: PrismaClient,
  params: {
    schoolId: string;
    email: string;
    phone: string;
    firstName: string;
    lastName: string;
    passwordHash: string;
    sectionId: string;
    rollNumber: string;
    academicYearId: string;
    admissionDate: Date;
  }
) {
  const user = await prisma.user.upsert({
    where: { schoolId_email: { schoolId: params.schoolId, email: params.email } },
    update: {
      phone: params.phone,
      firstName: params.firstName,
      lastName: params.lastName,
      role: UserRole.STUDENT,
      isActive: true,
      passwordHash: params.passwordHash,
    },
    create: {
      schoolId: params.schoolId,
      email: params.email,
      phone: params.phone,
      passwordHash: params.passwordHash,
      role: UserRole.STUDENT,
      firstName: params.firstName,
      lastName: params.lastName,
    },
  });

  const profile = await prisma.studentProfile.upsert({
    where: { userId: user.id },
    update: {
      sectionId: params.sectionId,
      rollNumber: params.rollNumber,
      admissionDate: params.admissionDate,
    },
    create: {
      userId: user.id,
      sectionId: params.sectionId,
      rollNumber: params.rollNumber,
      admissionDate: params.admissionDate,
    },
  });

  await prisma.studentEnrollment.upsert({
    where: { studentId_academicYearId: { studentId: profile.id, academicYearId: params.academicYearId } },
    update: { sectionId: params.sectionId, rollNumber: params.rollNumber, status: "ACTIVE" },
    create: {
      studentId: profile.id,
      academicYearId: params.academicYearId,
      sectionId: params.sectionId,
      rollNumber: params.rollNumber,
      status: "ACTIVE",
    },
  });

  return { user, profile };
}

async function purgeAcademicStructure(prisma: PrismaClient, schoolId: string) {
  // Remove students/parents first so section deletions don't get blocked.
  await prisma.user.deleteMany({
    where: { schoolId, role: { in: ["STUDENT", "PARENT"] } },
  });

  // Remove academic structure
  await prisma.class.deleteMany({ where: { schoolId } });
  await prisma.academicYear.deleteMany({ where: { schoolId } });
}

async function main() {
  const args = parseArgs();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const school = await prisma.school.findUnique({ where: { subdomain: args.subdomain } });
    if (!school) throw new Error(`School not found: ${args.subdomain}`);

    if (args.purge) {
      console.log(`[seed-headstart] Purging academic structure for ${school.subdomain}...`);
      await purgeAcademicStructure(prisma, school.id);
    } else {
      const existingClassCount = await prisma.class.count({ where: { schoolId: school.id } });
      if (existingClassCount > 0) {
        throw new Error(
          `School already has ${existingClassCount} classes. Re-run with --purge to rebuild academic structure.`
        );
      }
    }

    const passwordHash = await hash("password", 10);
    const { name: yearName, startYear, endYear } = currentAcademicYearName();

    // Create academic year + terms
    const academicYear = await prisma.academicYear.create({
      data: {
        schoolId: school.id,
        name: yearName,
        startDate: new Date(startYear, 7, 1),
        endDate: new Date(endYear, 6, 31),
        isCurrent: true,
      },
    });

    await prisma.term.createMany({
      data: [
        {
          academicYearId: academicYear.id,
          name: "Term 1",
          startDate: new Date(startYear, 7, 1),
          endDate: new Date(endYear, 0, 31),
        },
        {
          academicYearId: academicYear.id,
          name: "Term 2",
          startDate: new Date(endYear, 1, 1),
          endDate: new Date(endYear, 6, 31),
        },
      ],
    });

    // Create classes, sections, subjects
    const classDefs = classDefinitions(args.includePreClasses);
    const createdClasses = new Map<
      string,
      {
        id: string;
        name: string;
        grade: number | null;
        sections: { id: string; name: string }[];
        subjects: { id: string; name: string; code: string | null }[];
      }
    >();

    for (const def of classDefs) {
      const isJunior = def.grade !== null && def.grade >= 1 && def.grade <= 5;
      const isSenior = def.grade !== null && def.grade >= 6 && def.grade <= 8;
      const subjectData = isJunior ? SUBJECTS_JUNIOR : isSenior ? SUBJECTS_SENIOR : [];

      const cls = await prisma.class.create({
        data: {
          schoolId: school.id,
          name: def.name,
          displayOrder: def.displayOrder,
          sections: {
            create: args.sectionsPerClass.map((name) => ({ name, capacity: 30 })),
          },
          subjects: subjectData.length
            ? {
                create: subjectData.map((s) => ({
                  name: s.name,
                  code: s.code,
                  color: s.color,
                })),
              }
            : undefined,
        },
        include: { sections: true, subjects: true },
      });

      createdClasses.set(def.key, {
        id: cls.id,
        name: cls.name,
        grade: def.grade,
        sections: cls.sections.map((s) => ({ id: s.id, name: s.name })).sort((a, b) => a.name.localeCompare(b.name)),
        subjects: cls.subjects
          .map((s) => ({ id: s.id, name: s.name, code: s.code ?? null }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      });
    }

    // Teachers
    const existingTeachers = await prisma.teacherProfile.findMany({
      where: { user: { schoolId: school.id } },
      include: { user: true },
      orderBy: { user: { createdAt: "asc" } },
    });

    const teacherPool: Array<{ id: string; email: string | null; name: string }> = existingTeachers.map((t) => ({
      id: t.id,
      email: t.user.email,
      name: `${t.user.firstName} ${t.user.lastName}`,
    }));

    const seedTeachersJunior = new Map<string, { id: string; email: string; name: string }>();
    let teacherCounter = 1;

    const juniorNamePool = [
      ["Amina", "Sheikh"],
      ["Hamza", "Khalid"],
      ["Noor", "Fatima"],
      ["Saad", "Ibrahim"],
      ["Hira", "Naeem"],
      ["Zain", "Farooq"],
      ["Sadia", "Mahmood"],
      ["Umar", "Sultan"],
      ["Mariam", "Noman"],
      ["Bilal", "Hameed"],
    ];

    for (let grade = 1; grade <= 5; grade++) {
      for (const subject of SUBJECTS_JUNIOR) {
        const key = `g${grade}:${subject.code}`;
        const [fn, ln] = juniorNamePool[(teacherCounter - 1) % juniorNamePool.length];
        const email = seedEmail(`g${grade}.${subject.code}`, "headstart.edupal.com");
        const phone = `+92-399-10${String(teacherCounter).padStart(6, "0")}`;
        const employeeId = `HS-T${String(teacherCounter).padStart(4, "0")}`;
        teacherCounter += 1;

        const { profile } = await ensureTeacher(prisma, {
          schoolId: school.id,
          email,
          phone,
          firstName: fn,
          lastName: ln,
          passwordHash,
          employeeId,
        });

        seedTeachersJunior.set(key, { id: profile.id, email, name: `${fn} ${ln}` });
      }
    }

    // Senior mix teachers (add a few seed teachers to complement existing pool)
    const seedSeniorTeachers: Array<{ id: string; email: string; name: string }> = [];
    const seniorNamePool = [
      ["Sana", "Iqbal"],
      ["Farhan", "Javed"],
      ["Khadija", "Saleem"],
      ["Osman", "Rafiq"],
      ["Anaya", "Rashid"],
      ["Taha", "Aziz"],
    ];

    for (let i = 0; i < seniorNamePool.length; i++) {
      const [fn, ln] = seniorNamePool[i];
      const email = seedEmail(`senior.${i + 1}`, "headstart.edupal.com");
      const phone = `+92-399-20${String(i + 1).padStart(6, "0")}`;
      const employeeId = `HS-S${String(i + 1).padStart(4, "0")}`;
      const { profile } = await ensureTeacher(prisma, {
        schoolId: school.id,
        email,
        phone,
        firstName: fn,
        lastName: ln,
        passwordHash,
        employeeId,
      });
      seedSeniorTeachers.push({ id: profile.id, email, name: `${fn} ${ln}` });
    }

    const combinedTeacherPool = [...teacherPool, ...seedSeniorTeachers].map((t) => ({ id: t.id, name: t.name }));

    // A teacher that teaches 2 separate sections across different classes (explicit requirement)
    const crossSectionTeacher = seedSeniorTeachers[0];

    // Assign teachers to subjects/sections
    async function assignTeacherToSectionSubject(params: { sectionId: string; subjectId: string; teacherId: string }) {
      await prisma.sectionSubjectTeacher.upsert({
        where: { sectionId_subjectId: { sectionId: params.sectionId, subjectId: params.subjectId } },
        update: { teacherId: params.teacherId },
        create: { sectionId: params.sectionId, subjectId: params.subjectId, teacherId: params.teacherId },
      });
      await prisma.teacherSubject.upsert({
        where: { teacherId_subjectId: { teacherId: params.teacherId, subjectId: params.subjectId } },
        update: {},
        create: { teacherId: params.teacherId, subjectId: params.subjectId },
      });
    }

    // Junior: 1 teacher per subject per class (same teacher for all 3 sections)
    for (let grade = 1; grade <= 5; grade++) {
      const cls = createdClasses.get(`grade-${grade}`);
      if (!cls) continue;

      const sectionTeachers = [
        seedTeachersJunior.get(`g${grade}:MATH`)?.id,
        seedTeachersJunior.get(`g${grade}:ENG`)?.id,
        seedTeachersJunior.get(`g${grade}:SCI`)?.id,
      ].filter(Boolean) as string[];

      for (let sIdx = 0; sIdx < cls.sections.length; sIdx++) {
        const teacherId = sectionTeachers[sIdx % sectionTeachers.length];
        await prisma.sectionTeacher.upsert({
          where: { sectionId: cls.sections[sIdx].id },
          update: { teacherId },
          create: { sectionId: cls.sections[sIdx].id, teacherId },
        });
      }

      for (const subject of cls.subjects) {
        const code = subject.code;
        const teacher = code ? seedTeachersJunior.get(`g${grade}:${code}`) : null;
        if (!teacher) continue;
        for (const section of cls.sections) {
          await assignTeacherToSectionSubject({ sectionId: section.id, subjectId: subject.id, teacherId: teacher.id });
        }
      }
    }

    // Senior: mix it up
    for (let grade = 6; grade <= 8; grade++) {
      const cls = createdClasses.get(`grade-${grade}`);
      if (!cls) continue;

      const byName = new Map(cls.subjects.map((s) => [s.name, s]));
      const sections = cls.sections;

      const math = byName.get("Mathematics");
      const science = byName.get("Science");
      const english = byName.get("English");
      const urdu = byName.get("Urdu");
      const isl = byName.get("Islamiat");
      const cs = byName.get("Computer Science");

      const offset = grade - 6;
      const mathSciTeacher = combinedTeacherPool[(offset * 2) % combinedTeacherPool.length];
      const engUrduTeacher = combinedTeacherPool[(offset * 2 + 1) % combinedTeacherPool.length];
      const islTeacher = combinedTeacherPool[(offset * 2 + 2) % combinedTeacherPool.length];
      const csTeacher = combinedTeacherPool[(offset * 2 + 3) % combinedTeacherPool.length];

      // Class teacher per section (rotate a bit)
      const classTeachers = [mathSciTeacher.id, engUrduTeacher.id, islTeacher.id];
      for (let sIdx = 0; sIdx < sections.length; sIdx++) {
        await prisma.sectionTeacher.upsert({
          where: { sectionId: sections[sIdx].id },
          update: { teacherId: classTeachers[sIdx % classTeachers.length] },
          create: { sectionId: sections[sIdx].id, teacherId: classTeachers[sIdx % classTeachers.length] },
        });
      }

      if (math && science) {
        for (const section of sections) {
          await assignTeacherToSectionSubject({ sectionId: section.id, subjectId: math.id, teacherId: mathSciTeacher.id });
          await assignTeacherToSectionSubject({
            sectionId: section.id,
            subjectId: science.id,
            teacherId: mathSciTeacher.id,
          });
        }
      }

      if (english && urdu) {
        for (const section of sections) {
          await assignTeacherToSectionSubject({ sectionId: section.id, subjectId: english.id, teacherId: engUrduTeacher.id });
          await assignTeacherToSectionSubject({ sectionId: section.id, subjectId: urdu.id, teacherId: engUrduTeacher.id });
        }
      }

      // Islamiat: split sections to create cross-section patterns
      if (isl) {
        for (let sIdx = 0; sIdx < sections.length; sIdx++) {
          const section = sections[sIdx];
          const teacherId = sIdx === 0 ? islTeacher.id : engUrduTeacher.id;
          await assignTeacherToSectionSubject({ sectionId: section.id, subjectId: isl.id, teacherId });
        }
      }

      // CS: explicit "two separate sections from different classes" teacher
      if (cs) {
        for (let sIdx = 0; sIdx < sections.length; sIdx++) {
          const section = sections[sIdx];
          const isCross =
            (grade === 6 && section.name === "A") ||
            (grade === 7 && section.name === "B");
          const teacherId = isCross ? crossSectionTeacher.id : csTeacher.id;
          await assignTeacherToSectionSubject({ sectionId: section.id, subjectId: cs.id, teacherId });
        }
      }
    }

    // Students: 10 per section (configurable)
    const admissionDate = new Date(startYear, 7, 1);
    const firstNames = ["Ali", "Sara", "Bilal", "Zara", "Omar", "Hina", "Usman", "Maryam", "Hamza", "Amna"];
    const lastNames = ["Khan", "Ahmed", "Malik", "Sheikh", "Qureshi", "Raza", "Hussain", "Iqbal", "Naeem", "Siddiqui"];

    let studentCounter = 1;
    for (const cls of createdClasses.values()) {
      for (const section of cls.sections) {
        for (let i = 1; i <= args.studentsPerSection; i++) {
          const fn = firstNames[(studentCounter - 1) % firstNames.length];
          const ln = lastNames[(studentCounter - 1) % lastNames.length];
          const email = seedEmail(`student.${cls.name.replace(/\s+/g, "").toLowerCase()}.${section.name}.${i}`, "headstart.edupal.com");
          const phone = `+92-399-30${String(studentCounter).padStart(6, "0")}`;
          const rollNumber = `${cls.name.replace(/\D/g, "") || "0"}${section.name}${String(i).padStart(2, "0")}`;
          studentCounter += 1;

          await ensureStudent(prisma, {
            schoolId: school.id,
            email,
            phone,
            firstName: fn,
            lastName: ln,
            passwordHash,
            sectionId: section.id,
            rollNumber,
            academicYearId: academicYear.id,
            admissionDate,
          });
        }
      }
    }

    const [classCount, sectionCount, subjectCount, studentCount, teacherCount] = await Promise.all([
      prisma.class.count({ where: { schoolId: school.id } }),
      prisma.section.count({ where: { class: { schoolId: school.id } } }),
      prisma.subject.count({ where: { class: { schoolId: school.id } } }),
      prisma.studentProfile.count({ where: { user: { schoolId: school.id } } }),
      prisma.teacherProfile.count({ where: { user: { schoolId: school.id } } }),
    ]);

    console.log("[seed-headstart] Done:", {
      school: school.subdomain,
      classes: classCount,
      sections: sectionCount,
      subjects: subjectCount,
      students: studentCount,
      teachers: teacherCount,
      academicYear: yearName,
    });
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("[seed-headstart] Error:", e);
  process.exitCode = 1;
});

