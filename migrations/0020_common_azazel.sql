ALTER TABLE "assessment_knowledge_answers" ALTER COLUMN "selected_answer_index" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_knowledge_answers" ALTER COLUMN "is_correct" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "assessment_knowledge_answers" ADD COLUMN "answer_text" text;