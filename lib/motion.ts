import type { Transition, Variants } from "framer-motion";

export const premiumEase: Transition["ease"] = [0.22, 1, 0.36, 1];

export const standardTransition: Transition = {
  duration: 0.24,
  ease: premiumEase
};

export const quickTransition: Transition = {
  duration: 0.16,
  ease: premiumEase
};

export const gentleSpring: Transition = {
  type: "spring",
  stiffness: 420,
  damping: 34,
  mass: 0.8
};

export const pageShellVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 10,
    filter: "blur(8px)"
  },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: standardTransition
  },
  exit: {
    opacity: 0,
    y: -6,
    filter: "blur(4px)",
    transition: quickTransition
  }
};

export const fadeThroughVariants: Variants = {
  hidden: {
    opacity: 0
  },
  show: {
    opacity: 1,
    transition: standardTransition
  },
  exit: {
    opacity: 0,
    transition: quickTransition
  }
};

export const staggerContainerVariants: Variants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.035
    }
  }
};

export const cardItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 12,
    scale: 0.985
  },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: standardTransition
  },
  exit: {
    opacity: 0,
    y: -8,
    scale: 0.985,
    transition: quickTransition
  }
};

export const messageRowVariants: Variants = {
  hidden: (role?: "user" | "assistant") => ({
    opacity: 0,
    x: role === "user" ? 12 : -8,
    y: 8,
    scale: 0.992
  }),
  show: {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
    transition: standardTransition
  },
  exit: {
    opacity: 0,
    y: -6,
    scale: 0.992,
    transition: quickTransition
  }
};

export const sidebarBackdropVariants: Variants = {
  hidden: {
    opacity: 0
  },
  show: {
    opacity: 1,
    transition: quickTransition
  },
  exit: {
    opacity: 0,
    transition: quickTransition
  }
};
