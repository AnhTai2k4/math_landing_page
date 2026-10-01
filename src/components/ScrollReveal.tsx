import { motion, useReducedMotion } from "motion/react";
import { ReactNode } from "react";

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  className?: string;
}

export function ScrollReveal({ 
  children, 
  delay = 0, 
  direction = "up",
  className = ""
}: ScrollRevealProps) {
  const reduce=useReducedMotion();
  const offset={up:{y:16},down:{y:-16},left:{x:16},right:{x:-16}}[direction];
  return (
    <motion.div
      initial={reduce?false:offset}
      whileInView={{ x: 0, y: 0 }}
      viewport={{once:true,amount:0.05,margin:"0px 0px -24px 0px"}}
      transition={{ type:"tween", duration: reduce ? 0 : 0.32, delay: reduce ? 0 : Math.min(Math.max(delay,0), 0.1), ease: [0.22,1,0.36,1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
