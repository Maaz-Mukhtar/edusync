#!/usr/bin/env python3
"""Generate sample test files for upload testing."""

from fpdf import FPDF
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
import os

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# ============================================
# PDF FILES
# ============================================

def create_math_test_pdf():
    """Create a sample math test PDF."""
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Mathematics Test - Chapter 5", ln=True, align="C")
    pdf.set_font("Helvetica", "", 12)
    pdf.cell(0, 10, "Class: 10A | Subject: Mathematics | Total Marks: 50", ln=True, align="C")
    pdf.cell(0, 10, "Time: 1 Hour", ln=True, align="C")
    pdf.ln(10)

    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 10, "Section A: Multiple Choice (10 marks)", ln=True)
    pdf.set_font("Helvetica", "", 11)

    questions = [
        ("1. What is the value of x in the equation 2x + 5 = 15?", ["A) 3", "B) 5", "C) 7", "D) 10"]),
        ("2. The square root of 144 is:", ["A) 10", "B) 11", "C) 12", "D) 14"]),
        ("3. If a triangle has angles 60, 60, and 60 degrees, it is:", ["A) Scalene", "B) Isosceles", "C) Equilateral", "D) Right-angled"]),
        ("4. What is 15% of 200?", ["A) 20", "B) 25", "C) 30", "D) 35"]),
        ("5. The value of pi (approximately) is:", ["A) 3.14", "B) 2.14", "C) 4.14", "D) 3.41"]),
    ]

    for q, opts in questions:
        pdf.cell(0, 8, q, ln=True)
        for opt in opts:
            pdf.cell(0, 6, f"    {opt}", ln=True)
        pdf.ln(3)

    pdf.ln(5)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 10, "Section B: Short Answer (20 marks)", ln=True)
    pdf.set_font("Helvetica", "", 11)

    short_questions = [
        "6. Solve: 3x - 7 = 14 (4 marks)",
        "7. Find the area of a circle with radius 7 cm. (4 marks)",
        "8. Calculate the compound interest on Rs. 1000 at 10% for 2 years. (6 marks)",
        "9. Prove that the sum of angles in a triangle is 180 degrees. (6 marks)",
    ]

    for sq in short_questions:
        pdf.cell(0, 8, sq, ln=True)
        pdf.ln(15)

    pdf.output(os.path.join(OUTPUT_DIR, "math_test_chapter5.pdf"))
    print("Created: math_test_chapter5.pdf")


def create_science_test_pdf():
    """Create a sample science test PDF."""
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "Science Quiz - Forces and Motion", ln=True, align="C")
    pdf.set_font("Helvetica", "", 12)
    pdf.cell(0, 10, "Class: 9B | Subject: Physics | Total Marks: 25", ln=True, align="C")
    pdf.ln(10)

    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 10, "Answer all questions:", ln=True)
    pdf.set_font("Helvetica", "", 11)

    questions = [
        "1. Define Newton's First Law of Motion. (3 marks)",
        "2. A car travels 100 km in 2 hours. Calculate its average speed. (2 marks)",
        "3. What is the SI unit of force? (1 mark)",
        "4. Explain the difference between mass and weight. (4 marks)",
        "5. A force of 50 N acts on an object of mass 10 kg. Find the acceleration. (3 marks)",
        "6. Draw a free body diagram for a book resting on a table. (4 marks)",
        "7. What is friction? Give two examples. (4 marks)",
        "8. State Newton's Third Law and give an example. (4 marks)",
    ]

    for q in questions:
        pdf.cell(0, 8, q, ln=True)
        pdf.ln(12)

    pdf.output(os.path.join(OUTPUT_DIR, "science_quiz_forces.pdf"))
    print("Created: science_quiz_forces.pdf")


def create_english_test_pdf():
    """Create a sample English test PDF."""
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 16)
    pdf.cell(0, 10, "English Language Assessment", ln=True, align="C")
    pdf.set_font("Helvetica", "", 12)
    pdf.cell(0, 10, "Class: 8C | Total Marks: 40 | Time: 45 minutes", ln=True, align="C")
    pdf.ln(10)

    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 10, "Part A: Grammar (15 marks)", ln=True)
    pdf.set_font("Helvetica", "", 11)

    pdf.multi_cell(0, 6, "Fill in the blanks with the correct form of the verb:")
    pdf.ln(3)

    grammar = [
        "1. She _______ (go) to school every day.",
        "2. They _______ (play) football yesterday.",
        "3. He _______ (read) a book right now.",
        "4. We _______ (visit) our grandparents next week.",
        "5. The movie _______ (start) at 7 PM.",
    ]

    for g in grammar:
        pdf.cell(0, 8, g, ln=True)

    pdf.ln(5)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 10, "Part B: Vocabulary (10 marks)", ln=True)
    pdf.set_font("Helvetica", "", 11)
    pdf.multi_cell(0, 6, "Match the words with their meanings.")

    pdf.ln(5)
    pdf.set_font("Helvetica", "B", 12)
    pdf.cell(0, 10, "Part C: Writing (15 marks)", ln=True)
    pdf.set_font("Helvetica", "", 11)
    pdf.multi_cell(0, 6, "Write a short paragraph (100-150 words) on 'My Favorite Book'.")

    pdf.output(os.path.join(OUTPUT_DIR, "english_assessment.pdf"))
    print("Created: english_assessment.pdf")


# ============================================
# DOCX FILES
# ============================================

def create_history_test_docx():
    """Create a sample history test DOCX."""
    doc = Document()

    # Title
    title = doc.add_heading("History Examination", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    # Subtitle
    subtitle = doc.add_paragraph("World War II - Unit Test")
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER

    info = doc.add_paragraph("Class: 11A | Subject: History | Total Marks: 50 | Time: 1.5 Hours")
    info.alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_paragraph()

    # Section A
    doc.add_heading("Section A: Multiple Choice Questions (10 marks)", level=1)

    mcqs = [
        ("1. World War II began in which year?", ["A) 1935", "B) 1939", "C) 1941", "D) 1945"]),
        ("2. Which country was NOT part of the Allied Powers?", ["A) USA", "B) UK", "C) Germany", "D) USSR"]),
        ("3. The attack on Pearl Harbor occurred in:", ["A) 1939", "B) 1940", "C) 1941", "D) 1942"]),
        ("4. D-Day refers to the invasion of:", ["A) Poland", "B) France", "C) Germany", "D) Japan"]),
        ("5. The war in Europe ended in:", ["A) May 1945", "B) August 1945", "C) December 1944", "D) January 1946"]),
    ]

    for q, opts in mcqs:
        doc.add_paragraph(q)
        for opt in opts:
            doc.add_paragraph(f"    {opt}")

    # Section B
    doc.add_heading("Section B: Short Answer Questions (20 marks)", level=1)

    short_qs = [
        "6. Explain the causes of World War II. (5 marks)",
        "7. Describe the role of Winston Churchill during the war. (5 marks)",
        "8. What was the Holocaust? (5 marks)",
        "9. Explain the significance of the atomic bombings of Hiroshima and Nagasaki. (5 marks)",
    ]

    for sq in short_qs:
        doc.add_paragraph(sq)
        doc.add_paragraph()
        doc.add_paragraph()

    # Section C
    doc.add_heading("Section C: Essay Question (20 marks)", level=1)
    doc.add_paragraph("10. Analyze the long-term effects of World War II on global politics and the formation of the United Nations. (20 marks)")

    doc.save(os.path.join(OUTPUT_DIR, "history_exam_ww2.docx"))
    print("Created: history_exam_ww2.docx")


def create_geography_test_docx():
    """Create a sample geography test DOCX."""
    doc = Document()

    title = doc.add_heading("Geography Quiz", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    subtitle = doc.add_paragraph("Climate and Weather Patterns")
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER

    info = doc.add_paragraph("Class: 7A | Total Marks: 30")
    info.alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_paragraph()
    doc.add_heading("Instructions: Answer all questions.", level=2)

    questions = [
        "1. Define weather and climate. How are they different? (4 marks)",
        "2. Name the three main climate zones of the Earth. (3 marks)",
        "3. What causes seasons on Earth? Explain with a diagram. (5 marks)",
        "4. List four factors that affect the climate of a region. (4 marks)",
        "5. Explain the water cycle with a labeled diagram. (6 marks)",
        "6. What is global warming? What are its main causes? (4 marks)",
        "7. Describe two effects of climate change on polar regions. (4 marks)",
    ]

    for q in questions:
        doc.add_paragraph(q)
        doc.add_paragraph()

    doc.save(os.path.join(OUTPUT_DIR, "geography_quiz_climate.docx"))
    print("Created: geography_quiz_climate.docx")


def create_computer_test_docx():
    """Create a sample computer science test DOCX."""
    doc = Document()

    title = doc.add_heading("Computer Science Test", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER

    subtitle = doc.add_paragraph("Introduction to Programming")
    subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER

    info = doc.add_paragraph("Class: 9C | Total Marks: 40 | Time: 1 Hour")
    info.alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_paragraph()

    # Section A
    doc.add_heading("Section A: Theory (20 marks)", level=1)

    theory = [
        "1. What is an algorithm? Give an example. (4 marks)",
        "2. Explain the difference between a compiler and an interpreter. (4 marks)",
        "3. What are variables? Name three data types. (4 marks)",
        "4. Draw a flowchart to find the largest of three numbers. (4 marks)",
        "5. What is a loop? Name two types of loops. (4 marks)",
    ]

    for t in theory:
        doc.add_paragraph(t)
        doc.add_paragraph()

    # Section B
    doc.add_heading("Section B: Practical (20 marks)", level=1)

    practical = [
        "6. Write a program to print 'Hello World' in Python. (4 marks)",
        "7. Write a program to add two numbers entered by the user. (6 marks)",
        "8. Write a program to check if a number is even or odd. (5 marks)",
        "9. Write a program to print the first 10 natural numbers using a loop. (5 marks)",
    ]

    for p in practical:
        doc.add_paragraph(p)
        doc.add_paragraph()

    doc.save(os.path.join(OUTPUT_DIR, "computer_science_test.docx"))
    print("Created: computer_science_test.docx")


# ============================================
# MAIN
# ============================================

if __name__ == "__main__":
    print(f"Creating sample test files in: {OUTPUT_DIR}\n")

    # Create PDFs
    create_math_test_pdf()
    create_science_test_pdf()
    create_english_test_pdf()

    # Create DOCX files
    create_history_test_docx()
    create_geography_test_docx()
    create_computer_test_docx()

    print("\nAll sample files created successfully!")
    print(f"\nFiles are located at: {OUTPUT_DIR}")
