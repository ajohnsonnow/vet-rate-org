/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * The Consistency Engine - Data Auditor Hook
 * Automatically detects contradictions across all stored veteran data
 */

import { useState, useEffect } from 'react';

// Consistency Rules - Each rule checks for specific types of contradictions
const CONSISTENCY_RULES = [
  {
    id: 'frequency_mismatch',
    name: 'Frequency Contradiction',
    severity: 'high',
    check: (data) => {
      const contradictions = [];
      
      // Check if claimed frequency matches actual logged frequency
      if (data.statements && data.symptomLogs) {
        Object.values(data.statements).forEach(statement => {
          const statementLower = statement.content?.toLowerCase() || '';
          
          // Look for frequency claims in statement
          if (statementLower.includes('daily') || statementLower.includes('constant') || 
              statementLower.includes('weekly') || statementLower.includes('monthly')) {
            
            const frequencyInStatement = extractFrequency(statementLower);
            
            if (frequencyInStatement && data.symptomLogs) {
              // Compare with actual log frequency
              const loggedFrequency = calculateLoggedFrequency(data.symptomLogs, statement.condition);
              
              if (isFrequencyMismatch(frequencyInStatement, loggedFrequency)) {
                contradictions.push({
                  type: 'frequency',
                  location1: 'Personal Statement',
                  location2: 'Symptom Logger',
                  issue: `Statement says "${frequencyInStatement}" but logs show "${loggedFrequency}"`,
                  severity: 'high',
                  fix: 'Update either your statement or ensure your symptom logs match what you wrote in your statement.'
                });
              }
            }
          }
        });
      }
      
      return contradictions;
    }
  },
  {
    id: 'severity_mismatch',
    name: 'Severity Contradiction',
    severity: 'high',
    check: (data) => {
      const contradictions = [];
      
      // Check if disability rating does not match claimed severity
      if (data.statements && data.ratings) {
        Object.values(data.statements).forEach(statement => {
          const statementLower = statement.content?.toLowerCase() || '';
          
          // Check for severity claims
          if (statementLower.includes('completely unable') || statementLower.includes('cannot work')) {
            const rating = data.ratings[statement.condition];
            if (rating && rating < 70) {
              contradictions.push({
                type: 'severity',
                location1: 'Personal Statement',
                location2: 'Rating Selection',
                issue: `Statement claims complete inability to work but rated at only ${rating}%`,
                severity: 'high',
                fix: 'Either update your statement to match the actual severity or file for a higher rating if your condition is truly more severe.'
              });
            }
          }
        });
      }
      
      return contradictions;
    }
  },
  {
    id: 'body_part_mismatch',
    name: 'Body Part Contradiction',
    severity: 'critical',
    check: (data) => {
      const contradictions = [];
      
      // Check for inconsistent body part references (left vs right)
      if (data.statements) {
        Object.values(data.statements).forEach(statement => {
          const content = statement.content || '';
          const lateralityInStatement = extractLaterality(content);
          
          if (lateralityInStatement.hasConflict) {
            contradictions.push({
              type: 'body_part',
              location1: 'Personal Statement',
              location2: 'Personal Statement',
              issue: `Statement mentions both ${lateralityInStatement.left} and ${lateralityInStatement.right} - unclear which is affected`,
              severity: 'critical',
              fix: 'Rewrite your statement to be crystal clear about which body part is affected. Use "left" or "right" consistently.'
            });
          }
        });
      }
      
      // Check across forms
      if (data.forms && data.statements) {
        Object.values(data.forms).forEach(form => {
          if (form.condition) {
            const matchingStatement = Object.values(data.statements).find(
              s => s.condition === form.condition
            );
            
            if (matchingStatement) {
              const formLaterality = extractLaterality(form.condition);
              const stmtLaterality = extractLaterality(matchingStatement.content);
              
              if (formLaterality.side && stmtLaterality.side && 
                  formLaterality.side !== stmtLaterality.side) {
                contradictions.push({
                  type: 'body_part',
                  location1: 'VA Form',
                  location2: 'Personal Statement',
                  issue: `Form says "${formLaterality.side}" but statement says "${stmtLaterality.side}"`,
                  severity: 'critical',
                  fix: 'Immediately fix this! The VA will deny your claim if you cannot even keep track of which body part is injured.'
                });
              }
            }
          }
        });
      }
      
      return contradictions;
    }
  },
  {
    id: 'timeline_mismatch',
    name: 'Timeline Contradiction',
    severity: 'medium',
    check: (data) => {
      const contradictions = [];
      
      // Check if onset dates conflict
      if (data.profile && data.statements) {
        const serviceEnd = new Date(data.profile.serviceEndDate);
        
        Object.values(data.statements).forEach(statement => {
          const content = statement.content?.toLowerCase() || '';
          
          // Look for timeline claims
          if (content.includes('since service') || content.includes('during deployment')) {
            // Check if symptom logs exist before service end date
            if (data.symptomLogs) {
              const logsForCondition = data.symptomLogs.filter(
                log => log.condition === statement.condition
              );
              
              const logsBeforeService = logsForCondition.filter(
                log => new Date(log.date) < serviceEnd
              );
              
              if (logsBeforeService.length > 0 && !content.includes('pre-existing')) {
                contradictions.push({
                  type: 'timeline',
                  location1: 'Personal Statement',
                  location2: 'Symptom Logger',
                  issue: `Statement says condition started during service, but logs show symptoms before service ended`,
                  severity: 'medium',
                  fix: 'Clarify when symptoms truly started. If condition existed before service, you must prove it was aggravated by service.'
                });
              }
            }
          }
        });
      }
      
      return contradictions;
    }
  },
  {
    id: 'activity_mismatch',
    name: 'Activity Contradiction',
    severity: 'critical',
    check: (data) => {
      const contradictions = [];
      
      // Check if claimed inabilities conflict with logged activities
      if (data.statements && data.symptomLogs) {
        Object.values(data.statements).forEach(statement => {
          const inabilities = extractInabilities(statement.content);
          
          if (inabilities.length > 0 && data.symptomLogs) {
            const logsForCondition = data.symptomLogs.filter(
              log => log.condition === statement.condition
            );
            
            logsForCondition.forEach(log => {
              const activities = extractActivities(log.notes);
              
              inabilities.forEach(inability => {
                const contradictoryActivity = activities.find(
                  activity => isContradictoryActivity(inability, activity)
                );
                
                if (contradictoryActivity) {
                  contradictions.push({
                    type: 'activity',
                    location1: 'Personal Statement',
                    location2: 'Symptom Logger',
                    issue: `Statement says you cannot ${inability}, but log mentions ${contradictoryActivity}`,
                    severity: 'critical',
                    fix: 'Delete contradictory log entries or rewrite your statement. The VA WILL catch this and use it to deny your claim.'
                  });
                }
              });
            });
          }
        });
      }
      
      return contradictions;
    }
  }
];

// Helper Functions
function extractFrequency(text) {
  if (text.includes('daily') || text.includes('every day')) return 'daily';
  if (text.includes('constant') || text.includes('always')) return 'constant';
  if (text.includes('weekly') || text.includes('few times a week')) return 'weekly';
  if (text.includes('monthly') || text.includes('occasionally')) return 'monthly';
  return null;
}

function calculateLoggedFrequency(logs, condition) {
  const relevantLogs = logs.filter(log => log.condition === condition);
  if (relevantLogs.length === 0) return 'never';
  
  // Calculate average days between logs
  const sortedLogs = relevantLogs.sort((a, b) => new Date(a.date) - new Date(b.date));
  if (sortedLogs.length < 2) return 'insufficient data';
  
  const totalDays = (new Date(sortedLogs[sortedLogs.length - 1].date) - new Date(sortedLogs[0].date)) / (1000 * 60 * 60 * 24);
  const avgDaysBetween = totalDays / (sortedLogs.length - 1);
  
  if (avgDaysBetween <= 1.5) return 'daily';
  if (avgDaysBetween <= 7) return 'weekly';
  if (avgDaysBetween <= 30) return 'monthly';
  return 'rarely';
}

function isFrequencyMismatch(claimed, actual) {
  const severityMap = { 'constant': 5, 'daily': 4, 'weekly': 3, 'monthly': 2, 'rarely': 1, 'never': 0 };
  const claimedLevel = severityMap[claimed] || 0;
  const actualLevel = severityMap[actual] || 0;
  
  // Mismatch if claimed frequency is 2+ levels higher than actual
  return claimedLevel - actualLevel >= 2;
}

function extractLaterality(text) {
  const leftMentions = (text.match(/\bleft\b/gi) || []).length;
  const rightMentions = (text.match(/\bright\b/gi) || []).length;
  
  return {
    left: leftMentions,
    right: rightMentions,
    hasConflict: leftMentions > 0 && rightMentions > 0,
    side: leftMentions > rightMentions ? 'left' : rightMentions > leftMentions ? 'right' : null
  };
}

function extractInabilities(text) {
  const inabilities = [];
  const patterns = [
    /cannot (lift|walk|stand|sit|bend|kneel|climb)/gi,
    /unable to (lift|walk|stand|sit|bend|kneel|climb)/gi,
    /can'?t (lift|walk|stand|sit|bend|kneel|climb)/gi
  ];
  
  patterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      inabilities.push(match[1].toLowerCase());
    }
  });
  
  return [...new Set(inabilities)];
}

function extractActivities(text) {
  const activities = [];
  const patterns = [
    /went to (gym|work|store|church)/gi,
    /(lifted|walked|ran|climbed|exercised)/gi,
    /(hiking|biking|swimming|jogging)/gi
  ];
  
  patterns.forEach(pattern => {
    const matches = text.matchAll(pattern);
    for (const match of matches) {
      activities.push(match[0].toLowerCase());
    }
  });
  
  return activities;
}

function isContradictoryActivity(inability, activity) {
  const contradictions = {
    'lift': ['lifted', 'gym', 'exercised'],
    'walk': ['walked', 'hiking', 'store', 'church'],
    'stand': ['work', 'store', 'church'],
    'climb': ['climbed', 'hiking'],
    'bend': ['gym', 'exercised'],
    'kneel': ['gym', 'church']
  };
  
  const contradictoryTerms = contradictions[inability] || [];
  return contradictoryTerms.some(term => activity.includes(term));
}

// Main Hook
export default function useConsistencyCheck() {
  const [contradictions, setContradictions] = useState([]);
  const [isChecking, setIsChecking] = useState(false);
  const [lastCheck, setLastCheck] = useState(null);

  const runCheck = () => {
    setIsChecking(true);
    
    try {
      // Gather all data from localStorage
      const data = {
        profile: JSON.parse(localStorage.getItem('veteranProfile') || 'null'),
        claims: JSON.parse(localStorage.getItem('savedClaims') || '[]'),
        statements: JSON.parse(localStorage.getItem('statements') || '{}'),
        forms: JSON.parse(localStorage.getItem('forms') || '{}'),
        ratings: JSON.parse(localStorage.getItem('ratings') || '{}'),
        symptomLogs: JSON.parse(localStorage.getItem('symptomLogs') || '[]')
      };

      // Run all consistency rules
      const allContradictions = [];
      CONSISTENCY_RULES.forEach(rule => {
        try {
          const ruleContradictions = rule.check(data);
          allContradictions.push(...ruleContradictions);
        } catch (error) {
          console.error(`Error in rule ${rule.id}:`, error);
        }
      });

      setContradictions(allContradictions);
      setLastCheck(new Date());
    } catch (error) {
      console.error('Consistency check error:', error);
    } finally {
      setIsChecking(false);
    }
  };

  // Auto-check on mount and every 30 seconds
  useEffect(() => {
    runCheck();
    const interval = setInterval(runCheck, 30000);
    return () => clearInterval(interval);
  }, []);

  // Count by severity
  const criticalCount = contradictions.filter(c => c.severity === 'critical').length;
  const highCount = contradictions.filter(c => c.severity === 'high').length;
  const mediumCount = contradictions.filter(c => c.severity === 'medium').length;
  const totalCount = contradictions.length;

  return {
    contradictions,
    isChecking,
    lastCheck,
    refresh: runCheck,
    criticalCount,
    highCount,
    mediumCount,
    totalCount
  };
}

// Health Status Helper
export function getHealthStatus(contradictions) {
  const criticalCount = contradictions.filter(c => c.severity === 'critical').length;
  const highCount = contradictions.filter(c => c.severity === 'high').length;
  
  if (criticalCount > 0) {
    return {
      color: 'red',
      icon: '🚨',
      message: 'Critical Issues'
    };
  }
  
  if (highCount > 0) {
    return {
      color: 'orange',
      icon: '⚠️',
      message: 'Issues Found'
    };
  }
  
  if (contradictions.length > 0) {
    return {
      color: 'yellow',
      icon: '⚡',
      message: 'Minor Issues'
    };
  }
  
  return {
    color: 'green',
    icon: '✓',
    message: 'All Clear'
  };
}
