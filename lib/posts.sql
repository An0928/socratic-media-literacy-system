CREATE TABLE posts (
  id VARCHAR(16) PRIMARY KEY,
  week INT NOT NULL,
  slot INT NOT NULL,
  username VARCHAR(64),
  handle VARCHAR(64),
  avatar_color VARCHAR(16),
  image_url VARCHAR(255),
  caption TEXT,
  likes INT,
  is_true TINYINT(1),
  source VARCHAR(64),
  source_url VARCHAR(255),
  observe_prompt TEXT,
  challenge_prompt TEXT,
  alternative_prompt TEXT
);