/**
 * SupplyLocker.org - Web of Conditions
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * "Minority Report-style" Interactive Force-Directed Graph
 * 
 * Visualizes secondary condition relationships as an interactive node map.
 * Primary conditions orbit in the center, secondary conditions branch out,
 * clicking any node shows the nexus logic connecting them.
 */

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import BuyMeCoffee from './BuyMeCoffee';
import ReportBugLink from './ReportBugLink';

/**
 * Secondary Condition Relationships Database
 * Maps primary conditions to their secondary conditions with nexus logic
 */
const CONDITION_WEB = {
  'Tinnitus': {
    category: 'Auditory',
    color: '#F59E0B',
    secondaries: [
      { condition: 'Hearing Loss', strength: 0.9, nexus: 'Both conditions stem from noise-induced damage to cochlear hair cells. The same acoustic trauma that causes tinnitus typically damages hearing.' },
      { condition: 'Migraines', strength: 0.7, nexus: 'Chronic tinnitus creates persistent auditory cortex stimulation, leading to neurological changes that trigger migraines.' },
      { condition: 'Anxiety', strength: 0.8, nexus: 'Constant ringing creates hypervigilance and stress responses, triggering the anxiety feedback loop.' },
      { condition: 'Depression', strength: 0.75, nexus: 'Sleep disruption and inability to find silence leads to depressive symptoms over time.' },
      { condition: 'Sleep Apnea', strength: 0.6, nexus: 'Tinnitus disrupts sleep architecture, contributing to or worsening sleep apnea symptoms.' },
      { condition: 'Insomnia', strength: 0.85, nexus: 'The phantom noise makes it difficult to fall asleep and stay asleep, causing chronic insomnia.' }
    ]
  },
  'PTSD': {
    category: 'Mental Health',
    color: '#8B5CF6',
    secondaries: [
      { condition: 'Depression', strength: 0.9, nexus: 'PTSD and depression share overlapping neurobiological pathways. Trauma alters serotonin and norepinephrine systems.' },
      { condition: 'Anxiety', strength: 0.95, nexus: 'Hyperarousal symptoms of PTSD directly cause generalized anxiety through constant fight-or-flight activation.' },
      { condition: 'Migraines', strength: 0.65, nexus: 'Stress hormones from PTSD cause chronic tension and vascular changes leading to migraines.' },
      { condition: 'Sleep Apnea', strength: 0.7, nexus: 'PTSD nightmares and hyperarousal disrupt normal sleep patterns, contributing to sleep apnea.' },
      { condition: 'Insomnia', strength: 0.85, nexus: 'Hypervigilance and nightmares prevent normal sleep initiation and maintenance.' },
      { condition: 'IBS', strength: 0.7, nexus: 'The gut-brain axis is disrupted by chronic stress, causing gastrointestinal dysfunction.' },
      { condition: 'GERD', strength: 0.6, nexus: 'Stress increases stomach acid production and weakens the lower esophageal sphincter.' },
      { condition: 'Hypertension', strength: 0.65, nexus: 'Chronic stress activation raises blood pressure over time through sustained cortisol elevation.' },
      { condition: 'Erectile Dysfunction', strength: 0.7, nexus: 'PTSD medications (SSRIs) and psychological factors both contribute to sexual dysfunction.' },
      { condition: 'Substance Abuse', strength: 0.75, nexus: 'Self-medication attempts to manage PTSD symptoms often lead to dependency.' }
    ]
  },
  'Lumbar Strain / DDD': {
    category: 'Musculoskeletal',
    color: '#EF4444',
    secondaries: [
      { condition: 'Radiculopathy', strength: 0.85, nexus: 'Degenerative disc changes compress nerve roots, causing radiating pain and numbness.' },
      { condition: 'Sciatica', strength: 0.8, nexus: 'Disc herniation or spinal stenosis irritates the sciatic nerve, causing leg symptoms.' },
      { condition: 'Hip Pain', strength: 0.7, nexus: 'Altered gait and posture from back pain creates secondary stress on hip joints.' },
      { condition: 'Knee Pain', strength: 0.65, nexus: 'Compensatory movements to protect the back strain knee joints.' },
      { condition: 'Depression', strength: 0.7, nexus: 'Chronic pain leads to depressive symptoms through shared inflammatory pathways.' },
      { condition: 'Obesity', strength: 0.6, nexus: 'Reduced mobility from pain leads to weight gain, which further stresses the spine.' },
      { condition: 'Sleep Disorders', strength: 0.65, nexus: 'Pain prevents comfortable sleeping positions, disrupting sleep quality.' },
      { condition: 'Erectile Dysfunction', strength: 0.55, nexus: 'Spinal nerve involvement can affect pelvic nerve function.' }
    ]
  },
  'Diabetes Mellitus Type II': {
    category: 'Endocrine',
    color: '#10B981',
    secondaries: [
      { condition: 'Peripheral Neuropathy', strength: 0.9, nexus: 'Chronic hyperglycemia damages small blood vessels supplying peripheral nerves.' },
      { condition: 'Retinopathy', strength: 0.85, nexus: 'High blood sugar damages retinal blood vessels, causing vision problems.' },
      { condition: 'Nephropathy', strength: 0.8, nexus: 'Diabetes damages kidney filtration units (glomeruli), leading to kidney disease.' },
      { condition: 'Hypertension', strength: 0.85, nexus: 'Insulin resistance and vascular changes from diabetes raise blood pressure.' },
      { condition: 'Coronary Artery Disease', strength: 0.8, nexus: 'Diabetes accelerates atherosclerosis through inflammation and lipid changes.' },
      { condition: 'Erectile Dysfunction', strength: 0.75, nexus: 'Vascular and nerve damage from diabetes impairs erectile function.' },
      { condition: 'Peripheral Vascular Disease', strength: 0.75, nexus: 'Poor circulation from diabetes affects extremities, especially feet.' },
      { condition: 'Depression', strength: 0.6, nexus: 'Managing chronic disease and complications contributes to depression.' }
    ]
  },
  'Sleep Apnea': {
    category: 'Sleep',
    color: '#3B82F6',
    secondaries: [
      { condition: 'Hypertension', strength: 0.85, nexus: 'Repeated oxygen desaturation triggers sympathetic nervous system, raising BP.' },
      { condition: 'Coronary Artery Disease', strength: 0.75, nexus: 'Chronic hypoxia and inflammation from apnea accelerate heart disease.' },
      { condition: 'Atrial Fibrillation', strength: 0.7, nexus: 'Oxygen fluctuations and cardiac strain trigger irregular heart rhythms.' },
      { condition: 'Stroke', strength: 0.7, nexus: 'Blood pressure surges and reduced oxygen increase stroke risk.' },
      { condition: 'Depression', strength: 0.7, nexus: 'Poor sleep quality and chronic fatigue lead to depressive symptoms.' },
      { condition: 'Diabetes Type II', strength: 0.65, nexus: 'Sleep deprivation impairs glucose metabolism and insulin sensitivity.' },
      { condition: 'GERD', strength: 0.6, nexus: 'Negative intrathoracic pressure from apnea episodes can worsen reflux.' },
      { condition: 'Cognitive Decline', strength: 0.65, nexus: 'Chronic hypoxia and sleep fragmentation affect brain function.' }
    ]
  },
  'Migraines': {
    category: 'Neurological',
    color: '#EC4899',
    secondaries: [
      { condition: 'Depression', strength: 0.75, nexus: 'Chronic pain and disability from migraines leads to depressive symptoms.' },
      { condition: 'Anxiety', strength: 0.7, nexus: 'Fear of triggering migraines creates anticipatory anxiety.' },
      { condition: 'Insomnia', strength: 0.65, nexus: 'Pain and neurological symptoms disrupt normal sleep patterns.' },
      { condition: 'GERD', strength: 0.5, nexus: 'Migraine medications and stress can worsen acid reflux.' },
      { condition: 'Cervical Strain', strength: 0.6, nexus: 'Tension-type migraines often involve neck muscle tension and strain.' }
    ]
  },
  'Knee Injury / Patellofemoral Syndrome': {
    category: 'Musculoskeletal',
    color: '#EF4444',
    secondaries: [
      { condition: 'Osteoarthritis (Knee)', strength: 0.85, nexus: 'Previous knee injury accelerates cartilage degeneration.' },
      { condition: 'Hip Pain', strength: 0.7, nexus: 'Favoring the injured knee changes gait, stressing the hip.' },
      { condition: 'Lumbar Strain', strength: 0.65, nexus: 'Altered biomechanics from knee injury affect spinal alignment.' },
      { condition: 'Ankle Instability', strength: 0.55, nexus: 'Compensation patterns affect ankle mechanics.' },
      { condition: 'Obesity', strength: 0.5, nexus: 'Reduced mobility leads to weight gain.' },
      { condition: 'Depression', strength: 0.6, nexus: 'Chronic pain and activity limitations cause depression.' }
    ]
  },
  'TBI (Traumatic Brain Injury)': {
    category: 'Neurological',
    color: '#EC4899',
    secondaries: [
      { condition: 'PTSD', strength: 0.8, nexus: 'TBI and PTSD often co-occur; brain injury affects stress response systems.' },
      { condition: 'Migraines', strength: 0.85, nexus: 'Post-traumatic headaches are common after TBI.' },
      { condition: 'Depression', strength: 0.8, nexus: 'Brain injury affects mood-regulating neurotransmitters.' },
      { condition: 'Cognitive Impairment', strength: 0.85, nexus: 'Direct damage to brain tissue affects memory and executive function.' },
      { condition: 'Tinnitus', strength: 0.7, nexus: 'Blast TBI often includes auditory system damage.' },
      { condition: 'Sleep Disorders', strength: 0.75, nexus: 'TBI disrupts normal sleep architecture and circadian rhythms.' },
      { condition: 'Vertigo', strength: 0.65, nexus: 'Vestibular system damage from head injury causes balance problems.' },
      { condition: 'Seizures', strength: 0.6, nexus: 'Brain scarring from TBI can create seizure foci.' }
    ]
  },
  'Hypertension': {
    category: 'Cardiovascular',
    color: '#DC2626',
    secondaries: [
      { condition: 'Coronary Artery Disease', strength: 0.85, nexus: 'High blood pressure damages arterial walls, accelerating atherosclerosis.' },
      { condition: 'Stroke', strength: 0.8, nexus: 'Sustained high BP increases risk of both ischemic and hemorrhagic stroke.' },
      { condition: 'Heart Failure', strength: 0.75, nexus: 'The heart works harder against high pressure, eventually weakening.' },
      { condition: 'Chronic Kidney Disease', strength: 0.75, nexus: 'High BP damages kidney blood vessels, reducing filtration.' },
      { condition: 'Retinopathy', strength: 0.65, nexus: 'Elevated pressure damages delicate retinal blood vessels.' },
      { condition: 'Erectile Dysfunction', strength: 0.6, nexus: 'Vascular damage affects penile blood flow; medications worsen it.' }
    ]
  },
  'GERD': {
    category: 'Gastrointestinal',
    color: '#F97316',
    secondaries: [
      { condition: 'Esophagitis', strength: 0.85, nexus: 'Chronic acid exposure inflames and damages esophageal lining.' },
      { condition: "Barrett's Esophagus", strength: 0.7, nexus: 'Long-term acid exposure causes precancerous cell changes.' },
      { condition: 'Asthma', strength: 0.55, nexus: 'Acid reflux can trigger bronchospasm and worsen asthma.' },
      { condition: 'Chronic Cough', strength: 0.65, nexus: 'Acid irritates the throat and airways, causing persistent cough.' },
      { condition: 'Sleep Disorders', strength: 0.6, nexus: 'Nighttime reflux disrupts sleep quality.' },
      { condition: 'Dental Problems', strength: 0.5, nexus: 'Acid erodes tooth enamel over time.' }
    ]
  },
  'Asthma': {
    category: 'Respiratory',
    color: '#06B6D4',
    secondaries: [
      { condition: 'GERD', strength: 0.6, nexus: 'Asthma medications can worsen reflux; reflux triggers asthma.' },
      { condition: 'Sleep Apnea', strength: 0.55, nexus: 'Airway inflammation and nighttime symptoms affect sleep.' },
      { condition: 'Anxiety', strength: 0.65, nexus: 'Fear of attacks and breathing difficulties cause anxiety.' },
      { condition: 'Sinusitis', strength: 0.6, nexus: 'Chronic inflammation affects upper and lower airways together.' },
      { condition: 'Depression', strength: 0.5, nexus: 'Chronic illness management leads to depression.' }
    ]
  }
};

/**
 * Get all unique conditions for the visualization
 */
const getAllConditions = () => {
  const conditions = new Set();
  Object.keys(CONDITION_WEB).forEach(primary => {
    conditions.add(primary);
    CONDITION_WEB[primary].secondaries.forEach(s => conditions.add(s.condition));
  });
  return Array.from(conditions);
};

/**
 * Physics simulation for force-directed graph
 */
const useForceSimulation = (nodes, links, width, height) => {
  const [positions, setPositions] = useState({});
  const velocities = useRef({});
  const animationRef = useRef();
  const frameCount = useRef(0);
  const lastUpdate = useRef(0);
  
  useEffect(() => {
    // Initialize positions in a circle
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) * 0.35;
    
    const initialPositions = {};
    const initialVelocities = {};
    
    nodes.forEach((node, i) => {
      const angle = (i / nodes.length) * 2 * Math.PI;
      initialPositions[node.id] = {
        x: centerX + radius * Math.cos(angle) + (Math.random() - 0.5) * 50,
        y: centerY + radius * Math.sin(angle) + (Math.random() - 0.5) * 50
      };
      initialVelocities[node.id] = { vx: 0, vy: 0 };
    });
    
    setPositions(initialPositions);
    velocities.current = initialVelocities;
    
    // Physics simulation with throttling
    const simulate = (timestamp) => {
      // Throttle to 30fps instead of 60fps for better performance
      if (timestamp - lastUpdate.current < 33) {
        animationRef.current = requestAnimationFrame(simulate);
        return;
      }
      lastUpdate.current = timestamp;
      
      frameCount.current++;
      
      setPositions(prev => {
        const newPos = { ...prev };
        const newVel = { ...velocities.current };
        let totalMotion = 0;
        
        // Repulsion between all nodes
        nodes.forEach(nodeA => {
          nodes.forEach(nodeB => {
            if (nodeA.id === nodeB.id) return;
            
            const posA = newPos[nodeA.id];
            const posB = newPos[nodeB.id];
            if (!posA || !posB) return;
            
            const dx = posB.x - posA.x;
            const dy = posB.y - posA.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            
            // Repulsion force (inverse square)
            const repulsion = 2000 / (dist * dist);
            const fx = (dx / dist) * repulsion;
            const fy = (dy / dist) * repulsion;
            
            newVel[nodeA.id].vx -= fx * 0.1;
            newVel[nodeA.id].vy -= fy * 0.1;
          });
        });
        
        // Attraction along links
        links.forEach(link => {
          const posA = newPos[link.source];
          const posB = newPos[link.target];
          if (!posA || !posB) return;
          
          const dx = posB.x - posA.x;
          const dy = posB.y - posA.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          
          // Spring force
          const targetDist = 120;
          const spring = (dist - targetDist) * 0.01 * link.strength;
          const fx = (dx / dist) * spring;
          const fy = (dy / dist) * spring;
          
          newVel[link.source].vx += fx;
          newVel[link.source].vy += fy;
          newVel[link.target].vx -= fx;
          newVel[link.target].vy -= fy;
        });
        
        // Center gravity
        nodes.forEach(node => {
          const pos = newPos[node.id];
          if (!pos) return;
          
          const dx = centerX - pos.x;
          const dy = centerY - pos.y;
          
          newVel[node.id].vx += dx * 0.001;
          newVel[node.id].vy += dy * 0.001;
        });
        
        // Apply velocities with damping
        nodes.forEach(node => {
          const vel = newVel[node.id];
          const pos = newPos[node.id];
          if (!vel || !pos) return;
          
          vel.vx *= 0.9;
          vel.vy *= 0.9;
          
          pos.x += vel.vx;
          pos.y += vel.vy;
          
          // Bounds
          pos.x = Math.max(50, Math.min(width - 50, pos.x));
          pos.y = Math.max(50, Math.min(height - 50, pos.y));
          
          // Track total motion for auto-stop
          totalMotion += Math.abs(vel.vx) + Math.abs(vel.vy);
        });
        
        velocities.current = newVel;
        
        // Auto-stop simulation when motion is minimal
        if (frameCount.current > 120 && totalMotion < 0.1) {
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationRef.current = null;
          }
          return prev;
        }
        
        return newPos;
      });
      
      animationRef.current = requestAnimationFrame(simulate);
    };
    
    frameCount.current = 0;
    lastUpdate.current = 0;
    animationRef.current = requestAnimationFrame(simulate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [nodes, links, width, height]);
  
  return positions;
};

export default function WebOfConditions({ onClose, onSelectCondition, onReportBug }) {
  const { t } = useLanguage();
  useBodyScrollLock(true);
  
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [selectedNode, setSelectedNode] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);
  const [selectedLink, setSelectedLink] = useState(null);
  const [filterCategory, setFilterCategory] = useState(null);
  
  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: Math.max(500, rect.height) });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);
  
  // Build nodes and links
  const { nodes, links } = useMemo(() => {
    const nodeMap = {};
    const linkList = [];
    
    Object.entries(CONDITION_WEB).forEach(([primary, data]) => {
      nodeMap[primary] = {
        id: primary,
        type: 'primary',
        category: data.category,
        color: data.color,
        size: 30
      };
      
      data.secondaries.forEach(sec => {
        if (!nodeMap[sec.condition]) {
          nodeMap[sec.condition] = {
            id: sec.condition,
            type: 'secondary',
            category: 'Secondary',
            color: '#6B7280',
            size: 20
          };
        }
        
        linkList.push({
          source: primary,
          target: sec.condition,
          strength: sec.strength,
          nexus: sec.nexus
        });
      });
    });
    
    // Filter by category if set
    let filteredNodes = Object.values(nodeMap);
    let filteredLinks = linkList;
    
    if (filterCategory) {
      const relevantPrimaries = Object.entries(CONDITION_WEB)
        .filter(([_, data]) => data.category === filterCategory)
        .map(([name]) => name);
      
      const relevantSecondaries = new Set();
      relevantPrimaries.forEach(p => {
        CONDITION_WEB[p].secondaries.forEach(s => relevantSecondaries.add(s.condition));
      });
      
      filteredNodes = filteredNodes.filter(n => 
        relevantPrimaries.includes(n.id) || relevantSecondaries.has(n.id)
      );
      
      filteredLinks = linkList.filter(l => 
        relevantPrimaries.includes(l.source)
      );
    }
    
    return { nodes: filteredNodes, links: filteredLinks };
  }, [filterCategory]);
  
  // Physics simulation
  const positions = useForceSimulation(nodes, links, dimensions.width, dimensions.height);
  
  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set();
    Object.values(CONDITION_WEB).forEach(data => cats.add(data.category));
    return Array.from(cats);
  }, []);
  
  // Handle node click (memoized)
  const handleNodeClick = useCallback((node) => {
    setSelectedNode(prevSelected => node.id === prevSelected ? null : node.id);
    setSelectedLink(null);
  }, []);
  
  // Handle link click (memoized)
  const handleLinkClick = useCallback((link) => {
    setSelectedLink(prevSelected => 
      prevSelected?.source === link.source && prevSelected?.target === link.target ? null : link
    );
    setSelectedNode(null);
  }, []);
  
  // Get connections for selected node
  const connections = useMemo(() => {
    if (!selectedNode) return [];
    
    return links
      .filter(l => l.source === selectedNode || l.target === selectedNode)
      .map(l => ({
        ...l,
        connected: l.source === selectedNode ? l.target : l.source,
        direction: l.source === selectedNode ? 'outgoing' : 'incoming'
      }));
  }, [selectedNode, links]);
  
  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="web-of-conditions-title"
    >
      <div className="min-h-screen px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-6xl mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-yellow-500 via-amber-500 to-yellow-500 text-white px-6 py-6 rounded-t-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
            
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <span className="text-3xl">🕸️</span>
                </div>
                <div>
                  <h2 id="web-of-conditions-title" className="text-2xl sm:text-3xl font-bold text-black">
                    Web of Conditions <span className="px-1.5 py-0.5 bg-amber-600 text-white text-[10px] font-bold rounded align-middle">BETA</span>
                  </h2>
                  <p className="text-yellow-800 text-sm sm:text-base mt-1">
                    Interactive Secondary Condition Map
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onReportBug && <ReportBugLink onClick={onReportBug} variant="dark" moduleName="Web of Conditions" />}
                <button
                  onClick={onClose}
                  className="p-2 text-black hover:bg-black/10 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          
          {/* Content */}
          <div className="p-6 bg-gray-900">
            {/* Category Filters */}
            <div className="mb-6 flex flex-wrap items-center gap-2">
            <span className="text-purple-300 text-sm mr-2">Filter:</span>
            <button
              onClick={() => setFilterCategory(null)}
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                !filterCategory ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                className={`px-3 py-1 rounded-full text-sm transition-colors ${
                  filterCategory === cat ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
        
        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Graph Area */}
          <div ref={containerRef} className="flex-1 relative">
            <svg
              width={dimensions.width}
              height={dimensions.height}
              className="bg-gray-950"
            >
              {/* Gradient definitions */}
              <defs>
                <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="white" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="white" stopOpacity="0" />
                </radialGradient>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              
              {/* Links */}
              {/* Links - Memoized */}
              {useMemo(() => links.map((link, i) => {
                const sourcePos = positions[link.source];
                const targetPos = positions[link.target];
                if (!sourcePos || !targetPos) return null;
                
                const isHighlighted = selectedNode === link.source || selectedNode === link.target ||
                  (selectedLink?.source === link.source && selectedLink?.target === link.target);
                
                return (
                  <g key={i}>
                    <line
                      x1={sourcePos.x}
                      y1={sourcePos.y}
                      x2={targetPos.x}
                      y2={targetPos.y}
                      stroke={isHighlighted ? '#A78BFA' : '#4B5563'}
                      strokeWidth={isHighlighted ? 3 : 1 + link.strength * 2}
                      strokeOpacity={selectedNode && !isHighlighted ? 0.2 : 0.6}
                      className="cursor-pointer transition-all duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLinkClick(link);
                      }}
                    />
                    {/* Clickable wider area */}
                    <line
                      x1={sourcePos.x}
                      y1={sourcePos.y}
                      x2={targetPos.x}
                      y2={targetPos.y}
                      stroke="transparent"
                      strokeWidth={15}
                      className="cursor-pointer"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLinkClick(link);
                      }}
                    />
                  </g>
                );
              }), [links, positions, selectedNode, selectedLink, handleLinkClick])}
              
              {/* Nodes - Memoized */}
              {useMemo(() => nodes.map(node => {
                const pos = positions[node.id];
                if (!pos) return null;
                
                const isSelected = selectedNode === node.id;
                const isConnected = connections.some(c => c.connected === node.id);
                const isHovered = hoveredNode === node.id;
                const isDimmed = selectedNode && !isSelected && !isConnected;
                
                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleNodeClick(node);
                    }}
                    onMouseEnter={() => setHoveredNode(node.id)}
                    onMouseLeave={() => setHoveredNode(null)}
                  >
                    {/* Glow effect */}
                    {(isSelected || isHovered) && (
                      <circle
                        r={node.size + 10}
                        fill={node.color}
                        opacity={0.3}
                        filter="url(#glow)"
                      />
                    )}
                    
                    {/* Node circle */}
                    <circle
                      r={isSelected ? node.size + 5 : node.size}
                      fill={node.color}
                      opacity={isDimmed ? 0.3 : 1}
                      stroke={isSelected ? 'white' : 'transparent'}
                      strokeWidth={2}
                      className="transition-all duration-200"
                    />
                    
                    {/* Node label */}
                    <text
                      y={node.size + 15}
                      textAnchor="middle"
                      fill={isDimmed ? '#6B7280' : 'white'}
                      fontSize={node.type === 'primary' ? 12 : 10}
                      fontWeight={node.type === 'primary' ? 'bold' : 'normal'}
                      className="pointer-events-none select-none"
                    >
                      {node.id.length > 20 ? node.id.substring(0, 18) + '...' : node.id}
                    </text>
                    
                    {/* Type indicator */}
                    {node.type === 'primary' && (
                      <text
                        y={-node.size - 5}
                        textAnchor="middle"
                        fill={node.color}
                        fontSize={8}
                        className="pointer-events-none select-none uppercase"
                      >
                        ★ Primary
                      </text>
                    )}
                  </g>
                );
              }), [nodes, positions, selectedNode, connections, hoveredNode, handleNodeClick])}
            </svg>
            
            {/* Instructions overlay */}
            {!selectedNode && !selectedLink && (
              <div className="absolute bottom-4 left-4 bg-gray-900/80 rounded-xl p-4 max-w-sm">
                <p className="text-purple-300 text-sm">
                  <span className="text-lg mr-2">💡</span>
                  Click a node to see its connections, or click a link to see the nexus logic.
                </p>
              </div>
            )}
          </div>
          
          {/* Details Panel */}
          <div className="w-80 bg-gray-900 border-l border-purple-800/50 overflow-y-auto">
            {selectedLink ? (
              /* Link Details */
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🔗</span>
                  <h3 className="font-bold text-white">Connection</h3>
                </div>
                
                <div className="bg-purple-900/30 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                    <span className="text-white font-semibold">{selectedLink.source}</span>
                  </div>
                  <div className="text-center text-purple-400">↓</div>
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-gray-500"></span>
                    <span className="text-white font-semibold">{selectedLink.target}</span>
                  </div>
                </div>
                
                <div className="bg-gray-800/50 rounded-xl p-4">
                  <h4 className="text-sm text-purple-300 uppercase mb-2">Medical Nexus</h4>
                  <p className="text-white text-sm leading-relaxed">{selectedLink.nexus}</p>
                </div>
                
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Connection Strength:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-purple-600 to-purple-400"
                        style={{ width: `${selectedLink.strength * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-purple-400 font-bold">{Math.round(selectedLink.strength * 100)}%</span>
                  </div>
                </div>
                
                <button
                  onClick={() => {
                    if (onSelectCondition) {
                      onSelectCondition(selectedLink.target);
                    }
                  }}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold hover:from-purple-700 hover:to-indigo-700 transition-all"
                >
                  📋 Add {selectedLink.target} to Claim
                </button>
              </div>
            ) : selectedNode ? (
              /* Node Details */
              <div className="p-4 space-y-4">
                <div className="flex items-center gap-2">
                  <span 
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: nodes.find(n => n.id === selectedNode)?.color }}
                  ></span>
                  <h3 className="font-bold text-white text-lg">{selectedNode}</h3>
                </div>
                
                {CONDITION_WEB[selectedNode] && (
                  <span className="inline-block px-3 py-1 bg-purple-900/50 text-purple-300 rounded-full text-sm">
                    {CONDITION_WEB[selectedNode].category}
                  </span>
                )}
                
                <div className="space-y-2">
                  <h4 className="text-sm text-purple-300 uppercase">
                    {CONDITION_WEB[selectedNode] ? 'Secondary Conditions' : 'Connected Primary Conditions'}
                  </h4>
                  
                  {connections.map((conn, i) => (
                    <button
                      key={i}
                      onClick={() => handleLinkClick({ source: conn.source, target: conn.target, nexus: conn.nexus, strength: conn.strength })}
                      className="w-full text-left p-3 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-white">{conn.connected}</span>
                        <span className="text-purple-400 text-sm">{Math.round(conn.strength * 100)}%</span>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-xs text-gray-400">
                          {conn.direction === 'outgoing' ? '↳ Secondary' : '↰ Primary'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
                
                {CONDITION_WEB[selectedNode] && (
                  <div className="bg-purple-900/20 border border-purple-700/30 rounded-xl p-4">
                    <p className="text-purple-200 text-sm">
                      <span className="text-lg mr-2">⚡</span>
                      This is a <strong>primary condition</strong> that can establish secondary service connection for {CONDITION_WEB[selectedNode].secondaries.length} other conditions.
                    </p>
                  </div>
                )}
              </div>
            ) : (
              /* Default State */
              <div className="p-4 space-y-4">
                <h3 className="font-bold text-white text-lg">How to Use</h3>
                
                <div className="space-y-3">
                  <div className="flex gap-3">
                    <span className="text-2xl">🟡</span>
                    <div>
                      <p className="text-white font-semibold">Primary Conditions</p>
                      <p className="text-gray-400 text-sm">Large colored nodes are service-connected primaries</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <span className="text-2xl">⚪</span>
                    <div>
                      <p className="text-white font-semibold">Secondary Conditions</p>
                      <p className="text-gray-400 text-sm">Smaller gray nodes are potential secondaries</p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <span className="text-2xl">➖</span>
                    <div>
                      <p className="text-white font-semibold">Connection Lines</p>
                      <p className="text-gray-400 text-sm">Thicker lines = stronger medical link</p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-indigo-900/30 border border-indigo-700/50 rounded-xl p-4">
                  <p className="text-indigo-200 text-sm">
                    <span className="text-lg mr-2">🎯</span>
                    Click any connection to see the <strong>medical nexus</strong> explaining the relationship.
                  </p>
                </div>
                
                <div className="pt-4 border-t border-gray-700">
                  <h4 className="text-sm text-gray-400 uppercase mb-2">Legend</h4>
                  <div className="space-y-2">
                    {Object.entries(CONDITION_WEB).slice(0, 5).map(([name, data]) => (
                      <div key={name} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: data.color }}></span>
                        <span className="text-gray-300 text-sm">{data.category}</span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Support CTA */}
                <div className="pt-4 border-t border-gray-700">
                  <div className="bg-purple-900/30 border border-purple-700/50 rounded-xl p-4">
                    <div className="flex items-center gap-3">
                      <img 
                        src="/images/Anth.jpg" 
                        alt="Anthony"
                        className="w-10 h-10 rounded-full object-cover border-2 border-purple-500 flex-shrink-0"
                      />
                      <div>
                        <p className="text-purple-200 text-sm font-semibold">
                          🔬 Medical research takes time
                        </p>
                        <p className="text-purple-300/70 text-xs mt-1">
                          Each nexus connection is backed by real medical literature. Help fund more research.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    
    {/* BuyMeCoffee - shows when user clicks a link/nexus */}
    <BuyMeCoffee 
        show={selectedLink !== null || selectedNode !== null} 
        trigger="web-conditions" 
        context={{ condition: selectedLink?.source || selectedNode }}
      />
    </div>
  );
}
