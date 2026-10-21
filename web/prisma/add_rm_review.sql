-- Add totalRatings to RmProfile
ALTER TABLE RmProfile ADD COLUMN totalRatings INTEGER NOT NULL DEFAULT 0;

-- Create RmReview table
CREATE TABLE IF NOT EXISTS RmReview (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL,
    rmId TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT,
    status TEXT NOT NULL DEFAULT 'APPROVED',
    createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (userId) REFERENCES User(id) ON DELETE CASCADE,
    FOREIGN KEY (rmId) REFERENCES User(id) ON DELETE CASCADE
);

-- Unique index to prevent duplicate reviews from same user for same RM
CREATE UNIQUE INDEX IF NOT EXISTS RmReview_userId_rmId_key ON RmReview(userId, rmId);
CREATE INDEX IF NOT EXISTS RmReview_rmId_status_idx ON RmReview(rmId, status);
CREATE INDEX IF NOT EXISTS RmReview_userId_idx ON RmReview(userId);
