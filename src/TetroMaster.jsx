import React, { useState, useEffect, useCallback } from 'react';

const BOARD_WIDTH = 10;
const BOARD_HEIGHT = 20;
const INITIAL_FALL_TIME = 1000;

// Tetromino shapes
const TETROMINOES = {
  I: [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0]
  ],
  O: [
    [1, 1],
    [1, 1]
  ],
  T: [
    [0, 1, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  S: [
    [0, 1, 1],
    [1, 1, 0],
    [0, 0, 0]
  ],
  Z: [
    [1, 1, 0],
    [0, 1, 1],
    [0, 0, 0]
  ],
  J: [
    [1, 0, 0],
    [1, 1, 1],
    [0, 0, 0]
  ],
  L: [
    [0, 0, 1],
    [1, 1, 1],
    [0, 0, 0]
  ]
};

const TETROMINO_TYPES = Object.keys(TETROMINOES);

// T-spin detection patterns
const T_SPIN_PATTERNS = {
  // Check corners around T piece center
  checkCorners: (board, centerX, centerY) => {
    const corners = [
      { x: centerX - 1, y: centerY - 1 }, // Top-left
      { x: centerX + 1, y: centerY - 1 }, // Top-right
      { x: centerX - 1, y: centerY + 1 }, // Bottom-left
      { x: centerX + 1, y: centerY + 1 }  // Bottom-right
    ];
    
    let filledCorners = 0;
    let frontCorners = 0; // Top corners
    let backCorners = 0;  // Bottom corners
    
    corners.forEach((corner, index) => {
      const isFilled = corner.x < 0 || corner.x >= BOARD_WIDTH || 
                      corner.y < 0 || corner.y >= BOARD_HEIGHT ||
                      (corner.y >= 0 && board[corner.y][corner.x] !== 0);
      
      if (isFilled) {
        filledCorners++;
        if (index < 2) frontCorners++;
        else backCorners++;
      }
    });
    
    return { filledCorners, frontCorners, backCorners };
  }
};

// SRS Wall Kick Data - Modern Tetris rotation system
const SRS_WALL_KICKS = {
  // Standard pieces (J, L, S, T, Z)
  JLSTZ: {
    '0->1': [[-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '1->0': [[1, 0], [1, -1], [0, 2], [1, 2]],
    '1->2': [[1, 0], [1, -1], [0, 2], [1, 2]],
    '2->1': [[-1, 0], [-1, 1], [0, -2], [-1, -2]],
    '2->3': [[1, 0], [1, 1], [0, -2], [1, -2]],
    '3->2': [[-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '3->0': [[-1, 0], [-1, -1], [0, 2], [-1, 2]],
    '0->3': [[1, 0], [1, 1], [0, -2], [1, -2]]
  },
  // I piece has different kick data
  I: {
    '0->1': [[-2, 0], [1, 0], [-2, -1], [1, 2]],
    '1->0': [[2, 0], [-1, 0], [2, 1], [-1, -2]],
    '1->2': [[-1, 0], [2, 0], [-1, 2], [2, -1]],
    '2->1': [[1, 0], [-2, 0], [1, -2], [-2, 1]],
    '2->3': [[2, 0], [-1, 0], [2, 1], [-1, -2]],
    '3->2': [[-2, 0], [1, 0], [-2, -1], [1, 2]],
    '3->0': [[1, 0], [-2, 0], [1, -2], [-2, 1]],
    '0->3': [[-1, 0], [2, 0], [-1, 2], [2, -1]]
  }
};

// Color palettes for each level
const COLOR_PALETTES = [
  { // Level 1 - Classic NES
    I: '#00f0f0', O: '#f0f000', T: '#a000f0', S: '#00f000',
    Z: '#f00000', J: '#ff6600', L: '#f0a000'
  },
  { // Level 2 - Sunset
    I: '#ff6b6b', O: '#ffd93d', T: '#a29bfe', S: '#55a3ff',
    Z: '#fd79a8', J: '#ff7675', L: '#fdcb6e'
  },
  { // Level 3 - Ocean
    I: '#0984e3', O: '#74b9ff', T: '#6c5ce7', S: '#00b894',
    Z: '#00cec9', J: '#0984e3', L: '#fdcb6e'
  },
  { // Level 4 - Forest
    I: '#00b894', O: '#55a3ff', T: '#a29bfe', S: '#00cec9',
    Z: '#ff7675', J: '#00b894', L: '#fdcb6e'
  },
  { // Level 5 - Neon
    I: '#ff0080', O: '#00ff80', T: '#8000ff', S: '#ff8000',
    Z: '#0080ff', J: '#80ff00', L: '#ff0040'
  }
];

const TetroMaster = () => {
  const [board, setBoard] = useState(() => 
    Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0))
  );
  const [currentPiece, setCurrentPiece] = useState(null);
  const [nextPiece, setNextPiece] = useState(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0); // Track rotation state for T-spins
  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [fallTime, setFallTime] = useState(INITIAL_FALL_TIME);
  const [clearedLines, setClearedLines] = useState([]);
  const [showTetris, setShowTetris] = useState(false);
  const [keysPressed, setKeysPressed] = useState(new Set());
  const [showGhost, setShowGhost] = useState(true);
  const [gameMode, setGameMode] = useState('modern'); // 'classic' or 'modern'
  const [gameOverAnimation, setGameOverAnimation] = useState(false);
  
  // 7-bag randomization system
  const [pieceBag, setPieceBag] = useState([]);
  const [bagIndex, setBagIndex] = useState(0);
  
  // Advanced scoring states
  const [combo, setCombo] = useState(0);
  const [lastClearWasTSpin, setLastClearWasTSpin] = useState(false);
  const [tSpinType, setTSpinType] = useState(''); // 'single', 'double', 'triple'
  const [scorePopups, setScorePopups] = useState([]);
  const [backToBack, setBackToBack] = useState(false);
  
  // Create a new 7-bag (contains all 7 pieces in random order)
  const createNewBag = () => {
    const bag = [...TETROMINO_TYPES];
    // Fisher-Yates shuffle
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
    return bag;
  };

  // Get next piece from 7-bag system
  const getNextPieceFromBag = () => {
    if (pieceBag.length === 0 || bagIndex >= pieceBag.length) {
      const newBag = createNewBag();
      setPieceBag(newBag);
      setBagIndex(0);
      const pieceType = newBag[0];
      setBagIndex(1);
      return {
        shape: TETROMINOES[pieceType],
        type: pieceType
      };
    }
    
    const pieceType = pieceBag[bagIndex];
    setBagIndex(bagIndex + 1);
    return {
      shape: TETROMINOES[pieceType],
      type: pieceType
    };
  };

  const rotatePiece = (piece) => {
    const rotated = piece.shape[0].map((_, index) =>
      piece.shape.map(row => row[index]).reverse()
    );
    return { ...piece, shape: rotated };
  };

  const detectTSpin = (piece, pos, boardBeforePlacement, wasKicked) => {
    if (piece.type !== 'T' || gameMode === 'classic') return false;
    
    // Must have used wall kicks to be a T-spin
    if (!wasKicked) return false;
    
    // Find the T piece center (the stem of the T)
    const centerX = pos.x + 1; // T piece center is always at x+1
    const centerY = pos.y + 1; // T piece center is always at y+1
    
    const { filledCorners, frontCorners, backCorners } = T_SPIN_PATTERNS.checkCorners(
      boardBeforePlacement, centerX, centerY
    );
    
    // T-spin requires at least 3 corners to be filled
    return filledCorners >= 3;
  };

  const tryRotateWithKicks = (piece, pos, clockwise = true) => {
    const oldRotation = rotation;
    const newRotation = (rotation + (clockwise ? 1 : -1) + 4) % 4;
    
    if (gameMode === 'classic') {
      // Classic mode - simple rotation without kicks
      const rotated = rotatePiece(piece);
      if (isValidMove(board, rotated, pos)) {
        setRotation(newRotation);
        return { piece: rotated, position: pos, wasKicked: false };
      }
      return null;
    }

    // Modern mode - SRS with wall kicks
    const rotated = rotatePiece(piece);
    
    // First try basic rotation
    if (isValidMove(board, rotated, pos)) {
      setRotation(newRotation);
      return { piece: rotated, position: pos, wasKicked: false };
    }

    // If basic rotation fails, try wall kicks
    const pieceType = piece.type;
    const kickData = (pieceType === 'I') ? SRS_WALL_KICKS.I : SRS_WALL_KICKS.JLSTZ;
    
    // Use proper kick data based on rotation
    const rotationKey = `${oldRotation}->${newRotation}`;
    const kicks = kickData[rotationKey] || [
      [-1, 0], [1, 0], [0, -1], [-1, -1], [1, -1], 
      [-2, 0], [2, 0], [0, -2], [-1, 1], [1, 1]
    ];
    
    for (const [dx, dy] of kicks) {
      const testPos = { x: pos.x + dx, y: pos.y + dy };
      if (isValidMove(board, rotated, testPos)) {
        setRotation(newRotation);
        return { piece: rotated, position: testPos, wasKicked: true };
      }
    }
    
    return null;
  };

  const isValidMove = (board, piece, pos) => {
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x] !== 0) {
          const newX = pos.x + x;
          const newY = pos.y + y;
          
          if (newX < 0 || newX >= BOARD_WIDTH || newY >= BOARD_HEIGHT) {
            return false;
          }
          if (newY >= 0 && board[newY][newX] !== 0) {
            return false;
          }
        }
      }
    }
    return true;
  };

  const placePiece = (board, piece, pos) => {
    const newBoard = board.map(row => [...row]);
    for (let y = 0; y < piece.shape.length; y++) {
      for (let x = 0; x < piece.shape[y].length; x++) {
        if (piece.shape[y][x] !== 0) {
          const boardY = pos.y + y;
          const boardX = pos.x + x;
          if (boardY >= 0) {
            newBoard[boardY][boardX] = piece.type;
          }
        }
      }
    }
    return newBoard;
  };

  const addScorePopup = (text, value, color = 'text-yellow-400') => {
    const popup = {
      id: Date.now() + Math.random(),
      text,
      value,
      color,
      x: Math.random() * 200 + 50,
      y: Math.random() * 100 + 50
    };
    setScorePopups(prev => [...prev, popup]);
    
    // Remove popup after animation
    setTimeout(() => {
      setScorePopups(prev => prev.filter(p => p.id !== popup.id));
    }, 2000);
  };

  const clearLines = (board) => {
    const linesToClear = [];
    
    for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
      if (board[y].every(cell => cell !== 0)) {
        linesToClear.push(y);
      }
    }
    
    if (linesToClear.length > 0) {
      setClearedLines(linesToClear);
      
      // Show Tetris animation for 4 lines
      if (linesToClear.length === 4) {
        setShowTetris(true);
        setTimeout(() => setShowTetris(false), 1000);
      }
      
      // Clear lines after animation
      setTimeout(() => {
        const newBoard = [];
        for (let y = BOARD_HEIGHT - 1; y >= 0; y--) {
          if (!linesToClear.includes(y)) {
            newBoard.unshift(board[y]);
          }
        }
        
        while (newBoard.length < BOARD_HEIGHT) {
          newBoard.unshift(Array(BOARD_WIDTH).fill(0));
        }
        
        setBoard(newBoard);
        setClearedLines([]);
      }, 300);
    }
    
    return { board, linesCleared: linesToClear.length };
  };

  const updateLevel = useCallback((newLines) => {
    const newLevel = Math.floor(newLines / 10) + 1;
    if (newLevel > level) {
      setLevel(newLevel);
      // More aggressive speed curve for better gameplay feel
      const newFallTime = Math.max(50, INITIAL_FALL_TIME - (newLevel - 1) * 75);
      setFallTime(newFallTime);
      
      // Show level up notification
      addScorePopup(`LEVEL ${newLevel}`, 0, 'text-green-400');
      
      console.log(`Level up! New level: ${newLevel}, Fall time: ${newFallTime}ms`);
      return newLevel;
    }
    return level;
  }, [level]);

  const calculateAdvancedScore = (linesCleared, level, isTSpin = false, tSpinType = '', comboCount = 0, isBackToBack = false) => {
    if (linesCleared === 0) return 0;
    
    let baseScore = 0;
    let scoreText = '';
    let color = 'text-yellow-400';
    
    if (isTSpin) {
      // T-spin scoring
      const tSpinScores = {
        single: 800,
        double: 1200,
        triple: 1600
      };
      baseScore = tSpinScores[tSpinType] || 400;
      scoreText = `T-SPIN ${tSpinType.toUpperCase()}`;
      color = 'text-purple-400';
    } else {
      // Regular line clear scoring
      const baseScores = [0, 100, 300, 500, 800]; // Single, Double, Triple, Tetris
      baseScore = baseScores[linesCleared];
      
      if (linesCleared === 4) {
        scoreText = 'TETRIS';
        color = 'text-blue-400';
      } else if (linesCleared === 3) {
        scoreText = 'TRIPLE';
        color = 'text-green-400';
      } else if (linesCleared === 2) {
        scoreText = 'DOUBLE';
        color = 'text-orange-400';
      } else {
        scoreText = 'SINGLE';
      }
    }
    
    // Back-to-back bonus (50% more points)
    if (isBackToBack && (linesCleared === 4 || isTSpin)) {
      baseScore = Math.floor(baseScore * 1.5);
      scoreText = 'B2B ' + scoreText;
      color = 'text-red-400';
    }
    
    // Combo bonus
    let comboBonus = 0;
    if (comboCount > 0) {
      comboBonus = 50 * comboCount * level;
      if (comboCount > 1) {
        addScorePopup(`${comboCount}× COMBO`, comboBonus, 'text-cyan-400');
      }
    }
    
    const totalScore = (baseScore * level) + comboBonus;
    addScorePopup(scoreText, baseScore * level, color);
    
    return totalScore;
  };

  const spawnNewPiece = useCallback(() => {
    if (!nextPiece) return;
    
    const newPiece = nextPiece;
    const startX = Math.floor(BOARD_WIDTH / 2) - Math.floor(newPiece.shape[0].length / 2);
    const startY = 0;
    
    if (!isValidMove(board, newPiece, { x: startX, y: startY })) {
      setGameOverAnimation(true);
      // Trigger game over after animation
      setTimeout(() => {
        setGameOver(true);
        setGameOverAnimation(false);
      }, 2000);
      return;
    }
    
    setCurrentPiece(newPiece);
    setPosition({ x: startX, y: startY });
    setRotation(0);
    setNextPiece(gameMode === 'modern' ? getNextPieceFromBag() : createRandomPiece());
  }, [board, nextPiece, gameMode, pieceBag, bagIndex]);

  const createRandomPiece = () => {
    const type = TETROMINO_TYPES[Math.floor(Math.random() * TETROMINO_TYPES.length)];
    return {
      shape: TETROMINOES[type],
      type: type
    };
  };

  const drop = useCallback(() => {
    if (!currentPiece || gameOver || paused) return;
    
    const newPos = { x: position.x, y: position.y + 1 };
    
    if (isValidMove(board, currentPiece, newPos)) {
      setPosition(newPos);
    } else {
      const newBoard = placePiece(board, currentPiece, position);
      const { linesCleared } = clearLines(newBoard);
      
      if (linesCleared === 0) {
        setBoard(newBoard);
        setCombo(0); // Reset combo on no line clear
        setBackToBack(false);
        spawnNewPiece();
      } else {
        // Check for T-spin
        const isTSpin = detectTSpin(currentPiece, position, board, lastClearWasTSpin);
        const tSpinTypes = ['', 'single', 'double', 'triple'];
        const currentTSpinType = isTSpin ? tSpinTypes[linesCleared] : '';
        
        // Determine if this is back-to-back
        const isBackToBack = backToBack && (linesCleared === 4 || isTSpin);
        
        // Calculate advanced score
        const scoreGained = calculateAdvancedScore(
          linesCleared, 
          level, 
          isTSpin, 
          currentTSpinType, 
          combo, 
          isBackToBack
        );
        
        // Update game state
        setScore(prev => prev + scoreGained);
        setLines(prev => {
          const newLines = prev + linesCleared;
          const newLevel = Math.floor(newLines / 10) + 1;
          if (newLevel > level) {
            setLevel(newLevel);
            setFallTime(Math.max(50, INITIAL_FALL_TIME - (newLevel - 1) * 50));
          }
          return newLines;
        });
        
        // Update combo and back-to-back states
        setCombo(prev => prev + 1);
        setBackToBack(linesCleared === 4 || isTSpin);
        setLastClearWasTSpin(isTSpin);
        setTSpinType(currentTSpinType);
        
        // Spawn new piece after line clear animation
        setTimeout(() => {
          spawnNewPiece();
        }, 300);
      }
    }
  }, [board, currentPiece, position, gameOver, paused, level, spawnNewPiece, combo, backToBack, lastClearWasTSpin]);

  const move = (dir) => {
    if (!currentPiece || gameOver || paused) return;
    
    const newPos = { x: position.x + dir, y: position.y };
    if (isValidMove(board, currentPiece, newPos)) {
      setPosition(newPos);
    }
  };

  const rotate = () => {
    if (!currentPiece || gameOver || paused) return;
    
    const result = tryRotateWithKicks(currentPiece, position, true);
    if (result) {
      setCurrentPiece(result.piece);
      setPosition(result.position);
      setLastClearWasTSpin(result.wasKicked); // Track if rotation used kicks
    }
  };

  const hardDrop = () => {
    if (!currentPiece || gameOver || paused) return;
    
    let dropDistance = 0;
    let newY = position.y;
    
    while (isValidMove(board, currentPiece, { x: position.x, y: newY + 1 })) {
      newY++;
      dropDistance++;
    }
    
    if (dropDistance > 0) {
      setPosition({ x: position.x, y: newY });
      setScore(prev => prev + dropDistance * 2);
      // Immediately place the piece after hard drop
      setTimeout(() => {
        const newBoard = placePiece(board, currentPiece, { x: position.x, y: newY });
        const { linesCleared } = clearLines(newBoard);
        
        if (linesCleared === 0) {
          setBoard(newBoard);
          setCombo(0);
          setBackToBack(false);
          spawnNewPiece();
        } else {
          // Check for T-spin
          const isTSpin = detectTSpin(currentPiece, { x: position.x, y: newY }, board, lastClearWasTSpin);
          const tSpinTypes = ['', 'single', 'double', 'triple'];
          const currentTSpinType = isTSpin ? tSpinTypes[linesCleared] : '';
          
          // Determine if this is back-to-back
          const isBackToBack = backToBack && (linesCleared === 4 || isTSpin);
          
          // Calculate advanced score
          const scoreGained = calculateAdvancedScore(
            linesCleared, 
            level, 
            isTSpin, 
            currentTSpinType, 
            combo, 
            isBackToBack
          );
          
          setScore(prev => prev + scoreGained);
          setLines(prev => {
            const newLines = prev + linesCleared;
            updateLevel(newLines);
            return newLines;
          });
          
          // Update combo and back-to-back states
          setCombo(prev => prev + 1);
          setBackToBack(linesCleared === 4 || isTSpin);
          setLastClearWasTSpin(isTSpin);
          setTSpinType(currentTSpinType);
          
          setTimeout(() => {
            spawnNewPiece();
          }, 300);
        }
      }, 50);
    }
  };

  const togglePause = () => {
    if (!gameStarted || gameOver) return;
    setPaused(prev => !prev);
  };

  const toggleGhost = () => {
    setShowGhost(prev => !prev);
  };

  const toggleGameMode = () => {
    // Only allow mode change when game is not in progress
    if (!gameStarted || gameOver) {
      setGameMode(prev => prev === 'classic' ? 'modern' : 'classic');
    }
  };

  const getGhostPosition = () => {
    if (!currentPiece || gameOver || paused) return null;
    
    let ghostY = position.y;
    while (isValidMove(board, currentPiece, { x: position.x, y: ghostY + 1 })) {
      ghostY++;
    }
    
    return { x: position.x, y: ghostY };
  };

  const startGame = () => {
    // Initialize 7-bag system for modern mode
    if (gameMode === 'modern') {
      const firstBag = createNewBag();
      setPieceBag(firstBag);
      setBagIndex(2); // We'll use first two pieces immediately
      
      const firstPiece = { shape: TETROMINOES[firstBag[0]], type: firstBag[0] };
      const secondPiece = { shape: TETROMINOES[firstBag[1]], type: firstBag[1] };
      
      setCurrentPiece(firstPiece);
      setNextPiece(secondPiece);
    } else {
      // Classic mode uses pure random
      const firstPiece = createRandomPiece();
      const secondPiece = createRandomPiece();
      
      setCurrentPiece(firstPiece);
      setNextPiece(secondPiece);
    }
    
    setPosition({ x: Math.floor(BOARD_WIDTH / 2) - 1, y: 0 });
    setRotation(0);
    setGameStarted(true);
    setGameOver(false);
    setGameOverAnimation(false);
    setPaused(false);
    setScore(0);
    setLevel(1);
    setLines(0);
    setCombo(0);
    setBackToBack(false);
    setLastClearWasTSpin(false);
    setTSpinType('');
    setScorePopups([]);
    setFallTime(INITIAL_FALL_TIME);
    setBoard(Array(BOARD_HEIGHT).fill().map(() => Array(BOARD_WIDTH).fill(0)));
    setClearedLines([]);
    setShowTetris(false);
  };

  const resetGame = () => {
    setGameStarted(false);
    setCurrentPiece(null);
    setNextPiece(null);
    setPaused(false);
    setGameOverAnimation(false);
    setClearedLines([]);
    setShowTetris(false);
    setKeysPressed(new Set());
    setCombo(0);
    setBackToBack(false);
    setLastClearWasTSpin(false);
    setTSpinType('');
    setScorePopups([]);
    setRotation(0);
    setPieceBag([]);
    setBagIndex(0);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!gameStarted) return;
      
      const key = e.key;
      const wasPressed = keysPressed.has(key);
      
      if (!wasPressed) {
        setKeysPressed(prev => new Set(prev).add(key));
        
        switch (key) {
          case 'ArrowLeft':
            e.preventDefault();
            move(-1);
            break;
          case 'ArrowRight':
            e.preventDefault();
            move(1);
            break;
          case 'ArrowDown':
            e.preventDefault();
            if (!paused && !gameOver) {
              setScore(prev => prev + 1);
              drop();
            }
            break;
          case 'ArrowUp':
            e.preventDefault();
            rotate();
            break;
          case ' ':
            e.preventDefault();
            hardDrop();
            break;
          case 'p':
          case 'P':
            e.preventDefault();
            togglePause();
            break;
          case 'g':
          case 'G':
            e.preventDefault();
            toggleGhost();
            break;
          case 'm':
          case 'M':
            e.preventDefault();
            toggleGameMode();
            break;
        }
      }
    };

    const handleKeyUp = (e) => {
      setKeysPressed(prev => {
        const newSet = new Set(prev);
        newSet.delete(e.key);
        return newSet;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameStarted, paused, gameOver, move, drop, rotate, hardDrop, togglePause, toggleGhost, toggleGameMode, keysPressed]);

  useEffect(() => {
    if (!gameStarted || gameOver || paused) return;
    
    const gameLoop = setInterval(() => {
      drop();
    }, fallTime);
    
    return () => clearInterval(gameLoop);
  }, [gameStarted, gameOver, paused, fallTime, drop]);

  const renderBoard = () => {
    const currentPalette = COLOR_PALETTES[(level - 1) % COLOR_PALETTES.length];
    const displayBoard = board.map(row => [...row]);
    const ghostPos = getGhostPosition();
    
    // Add ghost piece
    if (showGhost && ghostPos && currentPiece && !gameOver && !paused && !gameOverAnimation && ghostPos.y !== position.y) {
      for (let y = 0; y < currentPiece.shape.length; y++) {
        for (let x = 0; x < currentPiece.shape[y].length; x++) {
          if (currentPiece.shape[y][x] !== 0) {
            const boardY = ghostPos.y + y;
            const boardX = ghostPos.x + x;
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              if (displayBoard[boardY][boardX] === 0) {
                displayBoard[boardY][boardX] = 'ghost';
              }
            }
          }
        }
      }
    }
    
    // Add current piece
    if (currentPiece && !gameOver && !paused && !gameOverAnimation) {
      for (let y = 0; y < currentPiece.shape.length; y++) {
        for (let x = 0; x < currentPiece.shape[y].length; x++) {
          if (currentPiece.shape[y][x] !== 0) {
            const boardY = position.y + y;
            const boardX = position.x + x;
            if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
              displayBoard[boardY][boardX] = currentPiece.type;
            }
          }
        }
      }
    }
    
    return displayBoard.map((row, y) => (
      <div key={y} className="flex">
        {row.map((cell, x) => (
          <div
            key={x}
            className={`w-6 h-6 border border-gray-700 ${
              clearedLines.includes(y) ? 'animate-pulse bg-white' : ''
            } ${
              gameOverAnimation ? 'animate-pulse' : ''
            }`}
            style={{
              backgroundColor: clearedLines.includes(y) 
                ? '#ffffff' 
                : gameOverAnimation && cell !== 0
                  ? '#ff0000'
                  : cell === 'ghost'
                    ? 'transparent'
                    : cell === 0 
                      ? '#1a1a1a' 
                      : currentPalette[cell],
              border: cell === 'ghost' 
                ? `2px dashed ${currentPalette[currentPiece?.type] || '#ffffff'}` 
                : '1px solid #374151',
              boxShadow: cell !== 0 && cell !== 'ghost' && !clearedLines.includes(y) 
                ? 'inset 2px 2px 4px rgba(255,255,255,0.3), inset -2px -2px 4px rgba(0,0,0,0.3)' 
                : 'none',
              transition: gameOverAnimation ? 'background-color 0.3s ease' : 'none'
            }}
          />
        ))}
      </div>
    ));
  };

  const renderNextPiece = () => {
    if (!nextPiece) return null;
    
    const currentPalette = COLOR_PALETTES[(level - 1) % COLOR_PALETTES.length];
    const shape = nextPiece.shape;
    const shapeHeight = shape.length;
    const shapeWidth = shape[0] ? shape[0].length : 0;
    
    // Calculate padding for centering
    const paddingTop = Math.floor((4 - shapeHeight) / 2);
    const paddingLeft = Math.floor((4 - shapeWidth) / 2);
    
    return (
      <div className="grid grid-cols-4 gap-0">
        {Array(4).fill().map((_, y) => 
          Array(4).fill().map((_, x) => {
            const shapeY = y - paddingTop;
            const shapeX = x - paddingLeft;
            const isInShape = shapeY >= 0 && shapeY < shapeHeight && 
                             shapeX >= 0 && shapeX < shapeWidth;
            const cell = isInShape && shape[shapeY][shapeX] ? nextPiece.type : 0;
            
            return (
              <div
                key={`${y}-${x}`}
                className="w-5 h-5 border border-gray-600"
                style={{
                  backgroundColor: cell === 0 ? '#2a2a2a' : currentPalette[cell],
                  boxShadow: cell !== 0 ? 'inset 2px 2px 3px rgba(255,255,255,0.3), inset -2px -2px 3px rgba(0,0,0,0.3)' : 'none'
                }}
              />
            );
          })
        )}
      </div>
    );
  };

  const renderScorePopups = () => {
    return scorePopups.map(popup => (
      <div
        key={popup.id}
        className={`absolute font-bold text-lg font-mono ${popup.color} animate-ping pointer-events-none z-30`}
        style={{
          left: popup.x,
          top: popup.y,
          animation: 'scorePopup 2s ease-out forwards'
        }}
      >
        {popup.text}
        {popup.value > 0 && <div className="text-sm">+{popup.value}</div>}
      </div>
    ));
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-900 p-4">
      <style jsx>{`
        @keyframes scorePopup {
          0% { opacity: 1; transform: translateY(0); }
          100% { opacity: 0; transform: translateY(-50px); }
        }
      `}</style>
      
      <div className="flex gap-8 items-start">
        {/* Game Board */}
        <div className="bg-gray-800 p-4 rounded-lg shadow-2xl relative">
          <div className="border-4 border-gray-600 bg-gray-900 p-2 relative">
            {renderBoard()}
            {renderScorePopups()}
            
            {/* Game over animation */}
            {gameOverAnimation && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                <div className="text-center">
                  <div className="text-6xl font-bold text-red-400 animate-pulse font-mono drop-shadow-lg mb-4">
                    GAME OVER
                  </div>
                  <div className="text-2xl font-bold text-white animate-bounce font-mono">
                    Press any key...
                  </div>
                </div>
              </div>
            )}
            
            {/* Pause overlay */}
            {paused && !gameOverAnimation && (
              <div className="absolute inset-0 bg-black bg-opacity-75 flex items-center justify-center z-10">
                <div className="text-white text-2xl font-bold font-mono">PAUSED</div>
              </div>
            )}
            
            {/* Tetris animation */}
            {showTetris && !gameOverAnimation && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <div className="text-6xl font-bold text-yellow-400 animate-bounce font-mono drop-shadow-lg">
                  TETRIS!
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Side Panel */}
        <div className="bg-gray-800 p-6 rounded-lg shadow-2xl w-64">
          <h1 className="text-3xl font-bold text-center mb-4 text-white font-mono">
            TETROMASTER
          </h1>
          
          {/* Game Mode Toggle - Only show when game not in progress */}
          {(!gameStarted || gameOver) && (
            <div className="mb-4 text-center">
              <button
                onClick={toggleGameMode}
                className={`font-bold py-2 px-4 rounded transition-colors text-sm ${
                  gameMode === 'modern' 
                    ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                    : 'bg-orange-600 hover:bg-orange-700 text-white'
                }`}
              >
                {gameMode === 'modern' ? 'MODERN' : 'CLASSIC'}
              </button>
              <div className="text-xs text-gray-400 mt-1">
                {gameMode === 'modern' ? '7-bag + T-spins' : 'Pure random'}
              </div>
            </div>
          )}
          
          {!gameStarted ? (
            <div className="text-center">
              <button
                onClick={startGame}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg text-xl transition-colors"
              >
                START GAME
              </button>
            </div>
          ) : (
            <>
              <div className="mb-6 text-white font-mono">
                <div className="flex justify-between mb-2">
                  <span>Score:</span>
                  <span className="text-yellow-400">{score.toLocaleString()}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Level:</span>
                  <span className="text-green-400">{level}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Lines:</span>
                  <span className="text-blue-400">{lines}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span>Speed:</span>
                  <span className="text-purple-400">{fallTime}ms</span>
                </div>
                {gameMode === 'modern' && (
                  <>
                    <div className="flex justify-between mb-2">
                      <span>Combo:</span>
                      <span className="text-cyan-400">{combo}×</span>
                    </div>
                    {backToBack && (
                      <div className="text-center mb-2">
                        <span className="text-red-400 font-bold animate-pulse">BACK-TO-BACK</span>
                      </div>
                    )}
                    {tSpinType && (
                      <div className="text-center mb-2">
                        <span className="text-purple-400 font-bold">T-SPIN {tSpinType.toUpperCase()}</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              
              <div className="mb-6">
                <h3 className="text-white font-mono mb-2">Next:</h3>
                <div className="bg-gray-900 p-4 rounded border-2 border-gray-600 flex justify-center">
                  {renderNextPiece()}
                </div>
              </div>
              
              {gameStarted && !gameOver && (
                <div className="mb-4 flex gap-2">
                  <button
                    onClick={togglePause}
                    className={`flex-1 font-bold py-2 px-3 rounded transition-colors text-sm ${
                      paused 
                        ? 'bg-green-600 hover:bg-green-700 text-white' 
                        : 'bg-yellow-600 hover:bg-yellow-700 text-white'
                    }`}
                  >
                    {paused ? 'RESUME' : 'PAUSE'}
                  </button>
                  <button
                    onClick={toggleGhost}
                    className={`flex-1 font-bold py-2 px-3 rounded transition-colors text-sm ${
                      showGhost 
                        ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                        : 'bg-gray-600 hover:bg-gray-700 text-white'
                    }`}
                  >
                    {showGhost ? 'GHOST ON' : 'GHOST OFF'}
                  </button>
                </div>
              )}
              
              {gameOver && (
                <div className="text-center">
                  <div className="text-red-400 font-bold text-xl mb-4">
                    GAME OVER
                  </div>
                  <button
                    onClick={resetGame}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded transition-colors"
                  >
                    NEW GAME
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
      
      {/* Instructions - Always visible at bottom */}
      <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-gray-800 bg-opacity-90 text-white text-xs px-4 py-2 rounded-lg font-mono">
        <div className="flex gap-4 items-center">
          <span>← → Move</span>
          <span>↓ Soft Drop</span>
          <span>↑ Rotate</span>
          <span>Space Hard Drop</span>
          <span>P Pause</span>
          <span>G Ghost</span>
          <span>M Mode</span>
        </div>
      </div>
    </div>
  );
};

export default TetroMaster;