import OpenAI from 'openai';

export interface TranslationRequest {
  text: string | string[];
  sourceLanguage?: string; // Auto-detect if not provided
  targetLanguage: string;
  context?: 'competency' | 'assessment' | 'training' | 'skill' | 'general';
  preserveFormatting?: boolean;
}

export interface TranslationResponse {
  originalText: string | string[];
  translatedText: string | string[];
  sourceLanguage: string;
  targetLanguage: string;
  context: string;
}

export interface CompetencyDataTranslation {
  // Competency Categories
  competencyCategory?: {
    name: string;
    description?: string;
  };
  
  // Competency Elements
  competencyElement?: {
    name: string;
    description?: string;
    assessorGuidance?: string;
  };
  
  // Competence Subcategories
  competenceSubcategory?: {
    name: string;
  };
  
  // Competence Criteria
  competenceCriteria?: {
    description: string;
  };
  
  // Training
  training?: {
    name: string;
    description?: string;
  };
  
  // Skills
  skill?: {
    name: string;
    category?: string;
  };
  
  // Assessments
  assessment?: {
    title: string;
    description?: string;
  };
  
  // Self Assessment Questions
  selfAssessmentQuestion?: {
    question: string;
    description?: string;
    options?: string[];
    scaleLabels?: string[];
    checklistItems?: string[];
  };
}

class TranslationService {
  private openai: OpenAI;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY environment variable is required');
    }
    
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Translate text or array of texts using OpenAI for contextual accuracy
   */
  async translateText(request: TranslationRequest): Promise<TranslationResponse> {
    try {
      const { text, sourceLanguage, targetLanguage, context = 'general', preserveFormatting = true } = request;
      
      const isArray = Array.isArray(text);
      const textToTranslate = isArray ? text.join('\n---SEPARATOR---\n') : text;
      
      // Build context-specific prompt for professional competency translation
      const contextPrompts = {
        competency: 'You are translating competency framework data for an enterprise skills management platform. Maintain professional terminology and industry-specific language.',
        assessment: 'You are translating assessment questions and descriptions for professional competency evaluations. Keep assessment language clear and precise.',
        training: 'You are translating training program content for enterprise learning management. Preserve educational terminology and learning objectives.',
        skill: 'You are translating skill names and categories for professional competency tracking. Use standard industry terminology.',
        general: 'You are translating content for an enterprise platform. Maintain professional tone and terminology.'
      };

      const systemPrompt = `${contextPrompts[context]} 

Instructions:
- Translate from ${sourceLanguage || 'auto-detected language'} to ${targetLanguage}
- Maintain professional tone and industry-specific terminology
- Preserve technical terms and acronyms when appropriate
- Keep formatting and structure intact
${isArray ? '- If text contains "---SEPARATOR---", translate each section separately and maintain the separators' : ''}
- Provide natural, contextually appropriate translations
- For competency and assessment content, ensure clarity and precision`;

      const userPrompt = `Please translate the following text to ${targetLanguage}:\n\n${textToTranslate}`;

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3, // Lower temperature for consistent professional translation
        max_tokens: 4000,
      });

      const translatedText = completion.choices[0]?.message?.content?.trim() || '';
      
      // Handle array responses
      const finalTranslation = isArray 
        ? translatedText.split('\n---SEPARATOR---\n').map(s => s.trim())
        : translatedText;

      return {
        originalText: text,
        translatedText: finalTranslation,
        sourceLanguage: sourceLanguage || 'auto-detected',
        targetLanguage,
        context
      };
    } catch (error) {
      console.error('Translation error:', error);
      throw new Error(`Translation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Translate structured competency data objects
   */
  async translateCompetencyData(
    data: CompetencyDataTranslation,
    targetLanguage: string,
    sourceLanguage?: string
  ): Promise<CompetencyDataTranslation> {
    const translated: CompetencyDataTranslation = {};

    try {
      // Translate Competency Category
      if (data.competencyCategory) {
        const fieldsToTranslate = [];
        const fieldKeys: (keyof typeof data.competencyCategory)[] = [];
        
        if (data.competencyCategory.name) {
          fieldsToTranslate.push(data.competencyCategory.name);
          fieldKeys.push('name');
        }
        if (data.competencyCategory.description) {
          fieldsToTranslate.push(data.competencyCategory.description);
          fieldKeys.push('description');
        }

        if (fieldsToTranslate.length > 0) {
          const result = await this.translateText({
            text: fieldsToTranslate,
            sourceLanguage,
            targetLanguage,
            context: 'competency'
          });

          const translatedArray = Array.isArray(result.translatedText) ? result.translatedText : [result.translatedText];
          translated.competencyCategory = { name: '', description: '' };
          
          fieldKeys.forEach((key, index) => {
            if (translated.competencyCategory && translatedArray[index]) {
              translated.competencyCategory[key] = translatedArray[index];
            }
          });
        }
      }

      // Translate Competency Element
      if (data.competencyElement) {
        const fieldsToTranslate = [];
        const fieldKeys: (keyof typeof data.competencyElement)[] = [];
        
        if (data.competencyElement.name) {
          fieldsToTranslate.push(data.competencyElement.name);
          fieldKeys.push('name');
        }
        if (data.competencyElement.description) {
          fieldsToTranslate.push(data.competencyElement.description);
          fieldKeys.push('description');
        }
        if (data.competencyElement.assessorGuidance) {
          fieldsToTranslate.push(data.competencyElement.assessorGuidance);
          fieldKeys.push('assessorGuidance');
        }

        if (fieldsToTranslate.length > 0) {
          const result = await this.translateText({
            text: fieldsToTranslate,
            sourceLanguage,
            targetLanguage,
            context: 'competency'
          });

          const translatedArray = Array.isArray(result.translatedText) ? result.translatedText : [result.translatedText];
          translated.competencyElement = { name: '', description: '', assessorGuidance: '' };
          
          fieldKeys.forEach((key, index) => {
            if (translated.competencyElement && translatedArray[index]) {
              translated.competencyElement[key] = translatedArray[index];
            }
          });
        }
      }

      // Translate Training
      if (data.training) {
        const fieldsToTranslate = [];
        const fieldKeys: (keyof typeof data.training)[] = [];
        
        if (data.training.name) {
          fieldsToTranslate.push(data.training.name);
          fieldKeys.push('name');
        }
        if (data.training.description) {
          fieldsToTranslate.push(data.training.description);
          fieldKeys.push('description');
        }

        if (fieldsToTranslate.length > 0) {
          const result = await this.translateText({
            text: fieldsToTranslate,
            sourceLanguage,
            targetLanguage,
            context: 'training'
          });

          const translatedArray = Array.isArray(result.translatedText) ? result.translatedText : [result.translatedText];
          translated.training = { name: '', description: '' };
          
          fieldKeys.forEach((key, index) => {
            if (translated.training && translatedArray[index]) {
              translated.training[key] = translatedArray[index];
            }
          });
        }
      }

      // Translate Self Assessment Question
      if (data.selfAssessmentQuestion) {
        translated.selfAssessmentQuestion = { 
          question: '', 
          description: '', 
          options: [], 
          scaleLabels: [], 
          checklistItems: [] 
        };
        
        // Translate main question and description
        const mainFields = [];
        const mainKeys: ('question' | 'description')[] = [];
        
        if (data.selfAssessmentQuestion.question) {
          mainFields.push(data.selfAssessmentQuestion.question);
          mainKeys.push('question');
        }
        if (data.selfAssessmentQuestion.description) {
          mainFields.push(data.selfAssessmentQuestion.description);
          mainKeys.push('description');
        }

        if (mainFields.length > 0) {
          const mainResult = await this.translateText({
            text: mainFields,
            sourceLanguage,
            targetLanguage,
            context: 'assessment'
          });

          const mainTranslated = Array.isArray(mainResult.translatedText) ? mainResult.translatedText : [mainResult.translatedText];
          mainKeys.forEach((key, index) => {
            if (translated.selfAssessmentQuestion && mainTranslated[index]) {
              translated.selfAssessmentQuestion[key] = mainTranslated[index];
            }
          });
        }

        // Translate options array
        if (data.selfAssessmentQuestion.options && translated.selfAssessmentQuestion) {
          const optionsResult = await this.translateText({
            text: data.selfAssessmentQuestion.options,
            sourceLanguage,
            targetLanguage,
            context: 'assessment'
          });
          translated.selfAssessmentQuestion.options = Array.isArray(optionsResult.translatedText) 
            ? optionsResult.translatedText 
            : [optionsResult.translatedText];
        }

        // Translate scale labels
        if (data.selfAssessmentQuestion.scaleLabels && translated.selfAssessmentQuestion) {
          const scaleResult = await this.translateText({
            text: data.selfAssessmentQuestion.scaleLabels,
            sourceLanguage,
            targetLanguage,
            context: 'assessment'
          });
          translated.selfAssessmentQuestion.scaleLabels = Array.isArray(scaleResult.translatedText) 
            ? scaleResult.translatedText 
            : [scaleResult.translatedText];
        }

        // Translate checklist items
        if (data.selfAssessmentQuestion.checklistItems && translated.selfAssessmentQuestion) {
          const checklistResult = await this.translateText({
            text: data.selfAssessmentQuestion.checklistItems,
            sourceLanguage,
            targetLanguage,
            context: 'assessment'
          });
          translated.selfAssessmentQuestion.checklistItems = Array.isArray(checklistResult.translatedText) 
            ? checklistResult.translatedText 
            : [checklistResult.translatedText];
        }
      }

      // Translate other simple objects using similar patterns
      const simpleObjects = [
        { source: data.competenceSubcategory, target: 'competenceSubcategory', context: 'competency' as const },
        { source: data.competenceCriteria, target: 'competenceCriteria', context: 'competency' as const },
        { source: data.skill, target: 'skill', context: 'skill' as const },
        { source: data.assessment, target: 'assessment', context: 'assessment' as const }
      ];

      for (const obj of simpleObjects) {
        if (obj.source) {
          const fieldsToTranslate = Object.values(obj.source).filter(Boolean);
          const fieldKeys = Object.keys(obj.source);

          if (fieldsToTranslate.length > 0) {
            const result = await this.translateText({
              text: fieldsToTranslate,
              sourceLanguage,
              targetLanguage,
              context: obj.context
            });

            const translatedArray = Array.isArray(result.translatedText) ? result.translatedText : [result.translatedText];
            (translated as any)[obj.target] = {};
            
            fieldKeys.forEach((key, index) => {
              if (translatedArray[index]) {
                (translated as any)[obj.target][key] = translatedArray[index];
              }
            });
          }
        }
      }

      return translated;
    } catch (error) {
      console.error('Competency data translation error:', error);
      throw new Error(`Failed to translate competency data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get supported languages for translation
   */
  getSupportedLanguages() {
    return [
      { code: 'en', name: 'English', nativeName: 'English' },
      { code: 'es', name: 'Spanish', nativeName: 'Español' },
      { code: 'fr', name: 'French', nativeName: 'Français' },
      { code: 'de', name: 'German', nativeName: 'Deutsch' },
      { code: 'it', name: 'Italian', nativeName: 'Italiano' },
      { code: 'pt', name: 'Portuguese', nativeName: 'Português' },
      { code: 'ru', name: 'Russian', nativeName: 'Русский' },
      { code: 'zh', name: 'Chinese', nativeName: '中文' },
      { code: 'ja', name: 'Japanese', nativeName: '日本語' },
      { code: 'ko', name: 'Korean', nativeName: '한국어' },
      { code: 'ar', name: 'Arabic', nativeName: 'العربية' },
      { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी' },
      { code: 'tr', name: 'Turkish', nativeName: 'Türkçe' },
      { code: 'pl', name: 'Polish', nativeName: 'Polski' },
      { code: 'nl', name: 'Dutch', nativeName: 'Nederlands' },
      { code: 'sv', name: 'Swedish', nativeName: 'Svenska' },
      { code: 'da', name: 'Danish', nativeName: 'Dansk' },
      { code: 'no', name: 'Norwegian', nativeName: 'Norsk' },
      { code: 'fi', name: 'Finnish', nativeName: 'Suomi' },
    ];
  }
}

export const translationService = new TranslationService();