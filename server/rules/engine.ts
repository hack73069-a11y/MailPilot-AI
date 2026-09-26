import {
  EmailMessage,
  AIAnalysis,
  UserPreferences,
  ReplyRule,
  ActionType,
  RuleCondition,
} from '../types.js';

export interface RuleEvaluationResult {
  action: ActionType;
  matchedRule?: ReplyRule;
  reason: string;
  isAfterHours: boolean;
  canAutoSend: boolean;
}

export class RuleEngine {
  /**
   * Evaluate user rules & safety guardrails against an email
   */
  evaluate(
    email: EmailMessage,
    analysis: AIAnalysis,
    rules: ReplyRule[],
    preferences: UserPreferences
  ): RuleEvaluationResult {
    const isAfterHours = this.checkIsAfterHours(preferences);

    // SAFETY HARD-GATE: Never auto-reply to sensitive messages
    if (analysis.is_sensitive) {
      return {
        action: 'ignore',
        reason: `Safety hard-gate triggered: ${analysis.sensitivity_reason || 'Sensitive/financial email'}`,
        isAfterHours,
        canAutoSend: false,
      };
    }

    // Check sender/domain blocklists
    const senderEmail = (email.senderEmail || '').toLowerCase();
    const senderDomain = senderEmail.split('@')[1] || '';

    if (preferences.blockedDomains?.some((d) => senderDomain.includes(d.toLowerCase()))) {
      return {
        action: 'ignore',
        reason: `Sender domain ${senderDomain} is on the blocked domains list`,
        isAfterHours,
        canAutoSend: false,
      };
    }

    if (preferences.blockedSenders?.some((s) => senderEmail === s.toLowerCase())) {
      return {
        action: 'ignore',
        reason: `Sender ${senderEmail} is on the blocked senders list`,
        isAfterHours,
        canAutoSend: false,
      };
    }

    if (preferences.blockedCategories?.includes(analysis.category)) {
      return {
        action: 'ignore',
        reason: `Category ${analysis.category} is explicitly blocked from auto-reply`,
        isAfterHours,
        canAutoSend: false,
      };
    }

    // If email doesn't require reply (e.g. spam, newsletter), default to ignore
    if (!analysis.requires_reply) {
      return {
        action: 'ignore',
        reason: `Email does not require a response (classified as ${analysis.category})`,
        isAfterHours,
        canAutoSend: false,
      };
    }

    // Sort rules by priority (ascending: 1 has higher priority than 2)
    const sortedRules = [...rules]
      .filter((r) => r.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of sortedRules) {
      const isMatch = this.matchesRule(rule, email, analysis, isAfterHours);
      if (isMatch) {
        // Enforce user's replyMode and confidence limits
        const calibratedAction = this.calibrateAction(
          rule.action,
          preferences,
          analysis,
          isAfterHours
        );

        return {
          action: calibratedAction.action,
          matchedRule: rule,
          reason: `Matched rule: "${rule.name}" (${calibratedAction.reason})`,
          isAfterHours,
          canAutoSend: calibratedAction.action === 'auto_send',
        };
      }
    }

    // Default behavior based on user's global replyMode
    const defaultCalibrated = this.calibrateAction(
      preferences.replyMode === 'automatic'
        ? 'auto_send'
        : preferences.replyMode === 'approval'
        ? 'approval_queue'
        : 'draft_only',
      preferences,
      analysis,
      isAfterHours
    );

    return {
      action: defaultCalibrated.action,
      reason: `Global mode "${preferences.replyMode}" applied (${defaultCalibrated.reason})`,
      isAfterHours,
      canAutoSend: defaultCalibrated.action === 'auto_send',
    };
  }

  private matchesRule(
    rule: ReplyRule,
    email: EmailMessage,
    analysis: AIAnalysis,
    isAfterHours: boolean
  ): boolean {
    if (!rule.conditions || rule.conditions.length === 0) return true;

    if (rule.conditionLogic === 'OR') {
      return rule.conditions.some((cond) =>
        this.evaluateCondition(cond, email, analysis, isAfterHours)
      );
    }

    // Default AND
    return rule.conditions.every((cond) =>
      this.evaluateCondition(cond, email, analysis, isAfterHours)
    );
  }

  private evaluateCondition(
    cond: RuleCondition,
    email: EmailMessage,
    analysis: AIAnalysis,
    isAfterHours: boolean
  ): boolean {
    const val = (cond.value || '').toLowerCase().trim();
    const sender = (email.sender || '').toLowerCase();
    const senderEmail = (email.senderEmail || '').toLowerCase();
    const domain = senderEmail.split('@')[1] || '';
    const subject = (email.subject || '').toLowerCase();
    const body = (email.bodyPlain || '').toLowerCase();

    switch (cond.field) {
      case 'sender':
        return cond.operator === 'equals'
          ? senderEmail === val
          : sender.includes(val);
      case 'domain':
        return cond.operator === 'equals' ? domain === val : domain.includes(val);
      case 'subject':
        return cond.operator === 'contains'
          ? subject.includes(val)
          : cond.operator === 'not_contains'
          ? !subject.includes(val)
          : subject === val;
      case 'keyword':
        return cond.operator === 'contains'
          ? subject.includes(val) || body.includes(val)
          : !subject.includes(val) && !body.includes(val);
      case 'category':
        return cond.operator === 'equals'
          ? analysis.category === val
          : analysis.category.includes(val as any);
      case 'urgency':
        return cond.operator === 'equals'
          ? analysis.urgency === val
          : cond.operator === 'not_contains'
          ? analysis.urgency !== val
          : true;
      case 'time_of_day':
        return val === 'after_hours' ? isAfterHours : !isAfterHours;
      case 'thread_status':
        return val === 'existing_thread' ? email.threadId.length > 0 : true;
      default:
        return true;
    }
  }

  private calibrateAction(
    targetAction: ActionType,
    preferences: UserPreferences,
    analysis: AIAnalysis,
    isAfterHours: boolean
  ): { action: ActionType; reason: string } {
    if (targetAction === 'ignore' || targetAction === 'notify_user') {
      return { action: targetAction, reason: 'Target action applied' };
    }

    // In automatic mode, send auto-replies autonomously without asking permission
    if (preferences.replyMode === 'automatic') {
      if (!analysis.is_sensitive) {
        return {
          action: 'auto_send',
          reason: 'Autonomous auto-reply mode active (no permission required)',
        };
      }
    }

    // If global mode is manual, always downgrade to draft/suggest
    if (preferences.replyMode === 'manual') {
      return { action: 'draft_only', reason: 'User global mode is set to Manual' };
    }

    // If global mode is approval, cap at approval_queue
    if (preferences.replyMode === 'approval' && targetAction === 'auto_send') {
      return {
        action: 'approval_queue',
        reason: 'User global mode requires human approval',
      };
    }

    // In automatic mode, promote approval_queue to auto_send if safe
    if (preferences.replyMode === 'automatic' && targetAction === 'approval_queue') {
      return {
        action: 'auto_send',
        reason: 'Automatic auto-reply mode active (no permission required)',
      };
    }

    // Auto-send confidence gate (only applies if user is not in pure automatic mode)
    if (targetAction === 'auto_send') {
      const minThreshold = preferences.minAutoSendConfidence ?? 0.70;
      if (analysis.confidence < minThreshold) {
        return {
          action: 'approval_queue',
          reason: `AI confidence ${(analysis.confidence * 100).toFixed(0)}% is below auto-send threshold (${(
            minThreshold * 100
          ).toFixed(0)}%)`,
        };
      }

      return { action: 'auto_send', reason: 'Confidence and safety checks passed' };
    }

    if (targetAction === 'approval_queue') {
      if (analysis.confidence < preferences.minApprovalConfidence) {
        return {
          action: 'draft_only',
          reason: `Low AI confidence ${(analysis.confidence * 100).toFixed(0)}%, created draft only`,
        };
      }
      return { action: 'approval_queue', reason: 'Queued for user review' };
    }

    return { action: targetAction, reason: 'Configured action' };
  }

  private checkIsAfterHours(preferences: UserPreferences): boolean {
    if (!preferences.workingHoursEnabled) return false;

    try {
      const now = new Date();
      // Format in user's timezone if possible
      const currentDay = now.getDay(); // 0 is Sunday, 1 is Monday ...
      if (!preferences.workingDays.includes(currentDay)) {
        return true; // Weekend / off-day
      }

      const [startHour, startMin] = (preferences.workingHoursStart || '09:00')
        .split(':')
        .map(Number);
      const [endHour, endMin] = (preferences.workingHoursEnd || '18:00')
        .split(':')
        .map(Number);

      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;

      return currentMinutes < startMinutes || currentMinutes > endMinutes;
    } catch {
      return false;
    }
  }
}

export const ruleEngine = new RuleEngine();
