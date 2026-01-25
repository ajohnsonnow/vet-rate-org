/**
 * SupplyLocker.org - Cloud Sync Manager Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * "The Off-Site Bunker" - Google Drive backup interface
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import ToolCardButton from './ToolCardButton';
import {
  initializeGoogleDrive,
  signInToGoogleDrive,
  signOutOfGoogleDrive,
  isSignedInToGoogleDrive,
  saveBackupToGoogleDrive,
  listBackupsFromGoogleDrive,
  restoreBackupFromGoogleDrive,
  deleteBackupFromGoogleDrive
} from '../utils/cloudSync';
import { exportAllData, importAllData } from '../utils/storage';

const CloudSyncManager = ({ onClose }) => {
  const { t } = useLanguage();
  useBodyScrollLock(true);

  const [isInitialized, setIsInitialized] = useState(false);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [backups, setBackups] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(null);

  // Initialize on mount with retry logic
  useEffect(() => {
    let retryCount = 0;
    const maxRetries = 10;
    
    const tryInitialize = async () => {
      // Wait for gapi to be available
      if (typeof window.gapi === 'undefined') {
        if (retryCount < maxRetries) {
          retryCount++;
          setStatus(`Waiting for Google API... (${retryCount}/${maxRetries})`);
          setTimeout(tryInitialize, 500);
          return;
        } else {
          setError('Google API failed to load. Please refresh the page.');
          return;
        }
      }
      
      await initializeDrive();
    };
    
    tryInitialize();
  }, []);

  const initializeDrive = async () => {
    try {
      setStatus('Initializing Google Drive...');
      await initializeGoogleDrive();
      setIsInitialized(true);
      setIsSignedIn(isSignedInToGoogleDrive());
      setStatus('');
    } catch (err) {
      setError('Failed to initialize Google Drive: ' + err.message);
      console.error(err);
    }
  };

  const handleSignIn = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const user = await signInToGoogleDrive();
      setUserInfo(user);
      setIsSignedIn(true);
      setStatus('? Connected to Google Drive');
      
      // Load existing backups
      await loadBackups();
    } catch (err) {
      setError('Failed to sign in to Google Drive. ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutOfGoogleDrive();
      setIsSignedIn(false);
      setUserInfo(null);
      setBackups([]);
      setStatus('Signed out of Google Drive');
    } catch (err) {
      setError('Failed to sign out: ' + err.message);
    }
  };

  const loadBackups = async () => {
    try {
      setIsLoading(true);
      const files = await listBackupsFromGoogleDrive();
      setBackups(files);
    } catch (err) {
      setError('Failed to load backups: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    try {
      setIsLoading(true);
      setError(null);
      setStatus('Creating backup...');
      
      // Export all app data
      const appData = await exportAllData();
      
      // Save to Google Drive
      const result = await saveBackupToGoogleDrive(appData);
      
      setStatus(`? Backup saved: ${result.fileName}`);
      
      // Refresh backup list
      await loadBackups();
    } catch (err) {
      setError('Failed to create backup: ' + err.message);
      setStatus('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreBackup = async (fileId, fileName) => {
    const confirmed = window.confirm(
      `Are you sure you want to restore from backup?\n\n` +
      `"${fileName}"\n\n` +
      `This will OVERWRITE your current data. This action cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setIsLoading(true);
      setError(null);
      setStatus('Restoring backup...');
      
      // Download and decrypt from Google Drive
      const restoredData = await restoreBackupFromGoogleDrive(fileId);
      
      // Import into app
      await importAllData(restoredData);
      
      setStatus('? Backup restored successfully! Refreshing page...');
      
      // Reload page to reflect changes
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (err) {
      setError('Failed to restore backup: ' + err.message);
      setStatus('');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteBackup = async (fileId, fileName) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete this backup?\n\n"${fileName}"\n\nThis cannot be undone.`
    );

    if (!confirmed) return;

    try {
      setIsLoading(true);
      await deleteBackupFromGoogleDrive(fileId);
      setStatus(`? Deleted: ${fileName}`);
      await loadBackups();
    } catch (err) {
      setError('Failed to delete backup: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A';
    const kb = bytes / 1024;
    return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(2)} MB`;
  };

  const formatDate = (isoString) => {
    return new Date(isoString).toLocaleString();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-green-500/30">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-green-600 to-emerald-600 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="text-3xl">??</div>
            <div>
              <h1 className="text-xl font-bold text-white">
                The Off-Site Bunker
              </h1>
              <p className="text-green-100 text-sm">
                Secure cloud backup with YOUR Google Drive
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-green-200 transition-colors text-2xl font-bold"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          
          {/* Explainer */}
          <div className="bg-gradient-to-r from-blue-500/10 to-green-500/10 border border-blue-400/30 rounded-lg p-6 mb-6">
            <div className="flex items-start gap-4">
              <div className="text-4xl">???</div>
              <div>
                <h2 className="text-xl font-bold text-blue-300 mb-2">
                  Your Data, Your Cloud, Zero Liability <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded align-middle">BETA</span>
                </h2>
                <ul className="space-y-2 text-gray-300 text-sm">
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">?</span>
                    <span>Backups are encrypted and saved to <strong>YOUR</strong> Google Drive</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">?</span>
                    <span>We never see your data-it goes directly from your browser to your cloud</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-400">?</span>
                    <span>If your computer dies, your claim data is safe</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Not Initialized Warning */}
          {!isInitialized && (
            <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-6 mb-6">
              <h3 className="text-red-300 font-bold mb-2">?? Google API Not Loaded</h3>
              <p className="text-gray-300 text-sm mb-2">
                {status || 'Waiting for Google API to load...'}
              </p>
              {error && (
                <p className="text-red-400 text-sm mb-2">
                  Error: {error}
                </p>
              )}
              <p className="text-gray-400 text-xs mt-3">
                If this persists, try refreshing the page or check browser console for errors.
              </p>
            </div>
          )}

          {/* Sign In Section */}
          {isInitialized && !isSignedIn && (
            <div className="text-center py-8">
              <div className="text-6xl mb-4">??</div>
              <h3 className="text-2xl font-bold text-white mb-3">
                Connect Your Google Drive
              </h3>
              <p className="text-gray-300 mb-6">
                Sign in with Google to start backing up your claim data securely.
              </p>
              <button
                onClick={handleSignIn}
                disabled={isLoading}
                className="px-6 py-3 bg-white hover:bg-gray-100 text-gray-800 font-semibold rounded-lg shadow-lg transition-colors flex items-center gap-3 mx-auto disabled:opacity-50"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Sign in with Google
              </button>
            </div>
          )}

          {/* Signed In - Backup Manager */}
          {isSignedIn && (
            <div className="space-y-6">
              
              {/* User Info */}
              {userInfo && (
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {userInfo.imageUrl && (
                      <img
                        src={userInfo.imageUrl}
                        alt={userInfo.name}
                        className="w-10 h-10 rounded-full"
                      />
                    )}
                    <div>
                      <p className="text-white font-semibold">{userInfo.name}</p>
                      <p className="text-sm text-gray-400">{userInfo.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}

              {/* Create Backup Button */}
              <ToolCardButton className="w-full" type="button" onClick={handleCreateBackup} disabled={isLoading}>
                <span className="text-2xl">??</span>
                <span>{isLoading ? 'Creating Backup...' : 'Create New Backup Now'}</span>
              </ToolCardButton>

              {/* Status Messages */}
              {status && (
                <div className="bg-blue-500/10 border border-blue-400/30 rounded-lg p-3">
                  <p className="text-blue-300 text-sm">{status}</p>
                </div>
              )}

              {error && (
                <div className="bg-red-500/10 border border-red-400/30 rounded-lg p-3">
                  <p className="text-red-300 text-sm">?? {error}</p>
                </div>
              )}

              {/* Backup List */}
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-white">
                    Your Backups ({backups.length})
                  </h3>
                  <button
                    onClick={loadBackups}
                    disabled={isLoading}
                    className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white text-sm rounded transition-colors"
                  >
                    ?? Refresh
                  </button>
                </div>

                {backups.length === 0 ? (
                  <p className="text-gray-400 text-center py-8">
                    No backups yet. Create your first backup above.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-96 overflow-y-auto">
                    {backups.map((backup) => (
                      <div
                        key={backup.id}
                        className="bg-gray-900 border border-gray-700 rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="text-white font-medium text-sm mb-1">
                              {backup.name}
                            </p>
                            <p className="text-xs text-gray-400">
                              Created: {formatDate(backup.createdTime)}
                            </p>
                            <p className="text-xs text-gray-400">
                              Size: {formatFileSize(backup.size)}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleRestoreBackup(backup.id, backup.name)}
                              disabled={isLoading}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-500 disabled:bg-gray-600 text-white text-xs rounded transition-colors"
                            >
                              Restore
                            </button>
                            <button
                              onClick={() => handleDeleteBackup(backup.id, backup.name)}
                              disabled={isLoading}
                              className="px-3 py-1 bg-red-600 hover:bg-red-500 disabled:bg-gray-600 text-white text-xs rounded transition-colors"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CloudSyncManager;
