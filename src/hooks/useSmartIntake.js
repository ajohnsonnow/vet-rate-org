import questionsDB from '../data/intake_questions_db.json';

/**
 * Smart Intake Form Hook
 * 
 * Purpose: Filter intake questions based on user tags derived from DD-214 analysis.
 * This implements "Differential Intake" - answer first, ask later.
 * 
 * Philosophy:
 * - Never ask questions we can answer from documents
 * - Demonstrate competence by using what we already know
 * - Focus user effort on high-value information only
 * 
 * Architecture:
 * - Consumes user tags (e.g., COMBAT_STRESSOR, PACT_POST_911)
 * - Filters questions based on dependency conditions
 * - Routes answers to appropriate tools (Pathfinder, SecondaryScout, etc.)
 * - Maintains "virtual answers" for skipped questions
 * 
 * @param {Array<string>} userTags - Tags accumulated from DD-214 analysis
 * @param {Object} userAnswers - Object tracking user's answers (question_id -> answer)
 * @returns {Object} Filtered questions and utility functions
 */
export const useSmartIntake = (userTags = [], userAnswers = {}) => {

  /**
   * Evaluate if a dependency condition is met
   * 
   * @param {Object} dependency - The dependency object from a question
   * @returns {boolean} True if condition is met (question should be shown)
   */
  const evaluateDependency = (dependency) => {
    if (!dependency) return true;

    const { condition, tag, tags, question_id } = dependency;

    switch (condition) {
      case 'NOT_HAS_TAG':
        // Show question ONLY if user does NOT have the tag
        // (Skip question if they DO have the tag)
        return !userTags.includes(tag);

      case 'HAS_TAG':
        // Show question ONLY if user HAS the tag
        return userTags.includes(tag);

      case 'HAS_ANY_TAG':
        // Show if user has ANY of the specified tags
        return tags && tags.some(t => userTags.includes(t));

      case 'NOT_HAS_ANY_TAG':
        // Show if user does NOT have any of the specified tags
        return tags && !tags.some(t => userTags.includes(t));

      case 'OR':
        // Show if user has ANY of the tags (alias for HAS_ANY_TAG)
        return tags && tags.some(t => userTags.includes(t));

      case 'AND':
        // Show if user has ALL of the tags
        return tags && tags.every(t => userTags.includes(t));

      case 'ANSWERED_YES':
        // Show if user answered "yes" to a previous question
        return userAnswers[question_id] === true || 
               userAnswers[question_id] === 'yes';

      case 'ANSWERED_NO':
        // Show if user answered "no" to a previous question
        return userAnswers[question_id] === false || 
               userAnswers[question_id] === 'no';

      case 'ANSWERED':
        // Show if user provided any answer to a previous question
        return question_id in userAnswers && 
               userAnswers[question_id] !== null && 
               userAnswers[question_id] !== undefined;

      default:
        console.warn(`Unknown dependency condition: ${condition}`);
        return true;
    }
  };

  /**
   * Get filtered questions based on current user state
   * 
   * @returns {Array} Sections with filtered questions
   */
  const getFilteredQuestions = () => {
    const activeSections = [];

    questionsDB.sections.forEach(section => {
      const filteredQuestions = section.questions.filter(q => {
        return evaluateDependency(q.dependency);
      });

      if (filteredQuestions.length > 0) {
        activeSections.push({
          ...section,
          questions: filteredQuestions
        });
      }
    });

    return activeSections;
  };

  /**
   * Get all questions that were skipped and their virtual answers
   * These need to be stored as if the user answered them
   * 
   * @returns {Object} Map of question_id -> virtual_answer
   */
  const getVirtualAnswers = () => {
    const virtualAnswers = {};

    questionsDB.sections.forEach(section => {
      section.questions.forEach(q => {
        // If question has a dependency that causes it to be skipped
        // AND it has a virtual_answer defined
        if (q.dependency && !evaluateDependency(q.dependency) && 'virtual_answer' in q) {
          virtualAnswers[q.id] = q.virtual_answer;
        }
      });
    });

    return virtualAnswers;
  };

  /**
   * Get skip reasons for display ("We skipped X questions because...")
   * 
   * @returns {Array} Array of skip reason objects
   */
  const getSkipReasons = () => {
    const skipReasons = [];

    questionsDB.sections.forEach(section => {
      section.questions.forEach(q => {
        if (q.dependency && !evaluateDependency(q.dependency) && q.reason_for_skip) {
          skipReasons.push({
            question_id: q.id,
            question_text: q.text,
            reason: q.reason_for_skip,
            section: section.title
          });
        }
      });
    });

    return skipReasons;
  };

  /**
   * Process an answer and determine if it should trigger tool actions
   * 
   * @param {string} questionId - The question ID
   * @param {any} answer - The user's answer
   * @returns {Array} Array of tool actions to trigger
   */
  const processTriggers = (questionId, answer) => {
    const triggers = [];

    // Find the question
    let question = null;
    for (const section of questionsDB.sections) {
      question = section.questions.find(q => q.id === questionId);
      if (question) break;
    }

    if (!question || !question.trigger_action) return triggers;

    const { on_answer, tool, action, priority } = question.trigger_action;

    // Check if answer matches trigger condition
    let shouldTrigger = false;

    if (on_answer === 'yes' && (answer === true || answer === 'yes')) {
      shouldTrigger = true;
    } else if (on_answer === 'no' && (answer === false || answer === 'no')) {
      shouldTrigger = true;
    } else if (on_answer === 'ANY_EXCEPT_NONE') {
      // For multi-select: trigger if any option selected except "None"
      if (Array.isArray(answer)) {
        shouldTrigger = answer.length > 0 && 
                       !answer.some(a => a.toLowerCase().includes('none') || a.toLowerCase().includes('neither'));
      }
    } else if (on_answer === 'ANY') {
      shouldTrigger = answer !== null && answer !== undefined && answer !== '';
    } else if (Array.isArray(on_answer)) {
      // Trigger if answer matches any in the array
      shouldTrigger = on_answer.includes(answer);
    }

    if (shouldTrigger) {
      triggers.push({
        tool,
        action,
        priority: priority || 'Normal',
        question_id: questionId,
        answer
      });
    }

    return triggers;
  };

  /**
   * Get total question count and how many were skipped
   * 
   * @returns {Object} Statistics about the intake form
   */
  const getIntakeStats = () => {
    const totalQuestions = questionsDB.sections.reduce(
      (sum, section) => sum + section.questions.length, 
      0
    );
    
    const filteredSections = getFilteredQuestions();
    const activeQuestions = filteredSections.reduce(
      (sum, section) => sum + section.questions.length,
      0
    );

    const skippedQuestions = totalQuestions - activeQuestions;

    return {
      total: totalQuestions,
      active: activeQuestions,
      skipped: skippedQuestions,
      efficiency: Math.round((skippedQuestions / totalQuestions) * 100)
    };
  };

  /**
   * Generate tags based on answers (inverse of using tags to filter)
   * 
   * @param {string} questionId - Question that was answered
   * @param {any} answer - The answer provided
   * @returns {Array<string>} New tags to add to user profile
   */
  const generateTagsFromAnswer = (questionId, answer) => {
    const newTags = [];

    // Find the question
    let question = null;
    for (const section of questionsDB.sections) {
      question = section.questions.find(q => q.id === questionId);
      if (question) break;
    }

    if (!question) return newTags;

    // Check if question defines tags to add on certain answers
    if (question.tags_on_yes && (answer === true || answer === 'yes')) {
      newTags.push(...question.tags_on_yes);
    }

    if (question.tags_on_no && (answer === false || answer === 'no')) {
      newTags.push(...question.tags_on_no);
    }

    return newTags;
  };

  return {
    getFilteredQuestions,
    getVirtualAnswers,
    getSkipReasons,
    processTriggers,
    getIntakeStats,
    generateTagsFromAnswer,
    evaluateDependency
  };
};
