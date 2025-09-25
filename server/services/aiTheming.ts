import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
// This is using OpenAI's API, which points to OpenAI's API servers and requires your own API key.
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export interface SectorTheme {
  primaryColors: string[];
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  featuresContent: {
    title: string;
    description: string;
  }[];
  ctaTitle: string;
  ctaDescription: string;
  heroImagePrompt: string;
}

export interface SectorSkills {
  technicalSkills: string[];
  safetySkills: string[];
  leadershipSkills: string[];
  specializedSkills: string[];
}

export class AIThemingService {
  
  /**
   * Generate sector-specific theme content and styling
   */
  async generateSectorTheme(industry: string, companyName?: string): Promise<SectorTheme> {
    const prompt = `Generate a professional landing page theme for a ${industry} company${companyName ? ` called "${companyName}"` : ''} that provides enterprise skills management and competency training services.

The theme should be industry-specific and reflect the sector's characteristics. Consider:
- ${industry === 'energy_renewables' ? 'Wind turbines, solar panels, sustainable energy, green technology' : ''}
- ${industry === 'oil_gas' ? 'Oil rigs, offshore platforms, petroleum industry, industrial landscapes' : ''}
- ${industry === 'manufacturing' ? 'Industrial facilities, precision machinery, automotive production' : ''}
- ${industry === 'healthcare' ? 'Medical environments, patient care, pharmaceutical research' : ''}
- ${industry === 'technology' ? 'Digital innovation, software development, cutting-edge technology' : ''}
- ${industry === 'construction' ? 'Building sites, infrastructure, civil engineering projects' : ''}
- ${industry === 'mining' ? 'Extractive operations, mining equipment, mineral processing' : ''}
- ${industry === 'logistics' ? 'Transportation networks, supply chains, global shipping' : ''}

Provide a JSON response with:
- primaryColors: Array of 5 hex colors suitable for the industry
- heroTitle: Compelling title (max 60 chars) 
- heroSubtitle: Supporting subtitle (max 40 chars)
- heroDescription: Description paragraph (max 200 chars)
- featuresContent: Array of 6 feature objects with title and description
- ctaTitle: Call-to-action title (max 50 chars)
- ctaDescription: CTA description (max 150 chars)
- heroImagePrompt: Detailed prompt for generating a hero background image`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system", 
            content: "You are an expert in corporate branding and UI/UX design for enterprise software. Generate professional, industry-appropriate themes."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result as SectorTheme;
    } catch (error) {
      console.error('Error generating sector theme:', error);
      throw new Error("Failed to generate sector theme: " + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Generate sector-specific skill categories and examples
   */
  async generateSectorSkills(industry: string): Promise<SectorSkills> {
    const prompt = `Generate relevant skill categories for professionals in the ${industry} industry.

Focus on skills that would be tracked in a competency management system, including:
- Technical/operational skills specific to the industry
- Safety and compliance requirements
- Leadership and management capabilities  
- Specialized certifications or expertise areas

Provide realistic, industry-specific skills that would be assessed and tracked.

Return JSON with arrays for:
- technicalSkills: 8-12 core technical skills
- safetySkills: 6-8 safety/compliance skills
- leadershipSkills: 6-8 leadership/management skills  
- specializedSkills: 8-10 specialized or advanced skills`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-5",
        messages: [
          {
            role: "system",
            content: "You are a workforce development expert. Generate realistic, industry-appropriate skill categories for competency tracking."
          },
          {
            role: "user", 
            content: prompt
          }
        ],
        response_format: { type: "json_object" },
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result as SectorSkills;
    } catch (error) {
      console.error('Error generating sector skills:', error);
      throw new Error("Failed to generate sector skills: " + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Generate a hero background image for the sector
   */
  async generateHeroImage(imagePrompt: string): Promise<string> {
    try {
      const enhancedPrompt = `Professional corporate hero image: ${imagePrompt}. High quality, clean composition, suitable for business website header. Beautiful lighting, modern aesthetic, inspiring and trustworthy feel.`;

      const response = await openai.images.generate({
        model: "dall-e-3",
        prompt: enhancedPrompt,
        n: 1,
        size: "1792x1024", // Wide aspect ratio for hero sections
        quality: "hd",
      });

      return response.data?.[0]?.url || '';
    } catch (error) {
      console.error('Error generating hero image:', error);
      throw new Error("Failed to generate hero image: " + (error instanceof Error ? error.message : 'Unknown error'));
    }
  }

  /**
   * Get predefined sector mappings for common industries
   */
  getSectorDefaults(industry: string): Partial<SectorTheme> {
    const defaults: Record<string, Partial<SectorTheme>> = {
      energy_renewables: {
        primaryColors: ['#22c55e', '#16a34a', '#15803d', '#166534', '#14532d'],
        heroImagePrompt: 'Modern wind turbines against a beautiful sunrise sky, renewable energy landscape with solar panels, clean and sustainable technology'
      },
      oil_gas: {
        primaryColors: ['#f97316', '#ea580c', '#dc2626', '#991b1b', '#7f1d1d'],
        heroImagePrompt: 'Professional offshore oil rig at sunset, industrial petroleum facility with beautiful sky, modern energy infrastructure'
      },
      manufacturing: {
        primaryColors: ['#3b82f6', '#2563eb', '#1d4ed8', '#1e40af', '#1e3a8a'],
        heroImagePrompt: 'High-tech manufacturing facility, precision machinery and automated production lines, modern industrial setting'
      },
      healthcare: {
        primaryColors: ['#06b6d4', '#0891b2', '#0e7490', '#155e75', '#164e63'],
        heroImagePrompt: 'Modern medical facility, healthcare professionals in action, clean hospital environment with natural lighting'
      }
    };

    return defaults[industry] || {};
  }
}

export const aiThemingService = new AIThemingService();