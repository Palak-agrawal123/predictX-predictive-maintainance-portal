"""
Neural Network Architectures for Turbofan Prognostics (FD002 & FD004)
=====================================================================
Includes:
1. AttentionCNNBiLSTM:
   - 1D-CNN temporal feature extractor
   - Bidirectional LSTM for forward/backward trajectory context
   - Attention Pooling to emphasize degraded operational states
   - Regularized MLP head with Dropout & Weight Decay
"""

import torch
import torch.nn as nn
import torch.nn.functional as F


class AttentionPooling(nn.Module):
    """
    Self-Attention pooling layer over sequence time-steps:
    Computes an importance weight alpha_t for each cycle in the window.
    """
    def __init__(self, hidden_dim: int):
        super().__init__()
        self.attn_weights = nn.Sequential(
            nn.Linear(hidden_dim, hidden_dim // 2),
            nn.Tanh(),
            nn.Linear(hidden_dim // 2, 1)
        )

    def forward(self, x):
        # x shape: (batch_size, seq_len, hidden_dim)
        scores = self.attn_weights(x)  # (batch_size, seq_len, 1)
        weights = F.softmax(scores, dim=1)  # (batch_size, seq_len, 1)
        context = torch.sum(x * weights, dim=1)  # (batch_size, hidden_dim)
        return context, weights


class AttentionCNNBiLSTM(nn.Module):
    """
    1D-CNN + Bidirectional LSTM with Attention Pooling.
    """
    def __init__(
        self,
        input_dim: int,
        conv_channels: int = 64,
        kernel_size: int = 3,
        lstm_hidden: int = 64,
        lstm_layers: int = 2,
        dropout: float = 0.25
    ):
        super().__init__()
        # 1D Convolution over features
        self.conv = nn.Sequential(
            nn.Conv1d(
                in_channels=input_dim,
                out_channels=conv_channels,
                kernel_size=kernel_size,
                padding=kernel_size // 2
            ),
            nn.BatchNorm1d(conv_channels),
            nn.ReLU(),
            nn.Dropout(dropout)
        )

        # Bidirectional LSTM: output size = 2 * lstm_hidden
        self.lstm = nn.LSTM(
            input_size=conv_channels,
            hidden_size=lstm_hidden,
            num_layers=lstm_layers,
            batch_first=True,
            bidirectional=True,
            dropout=dropout if lstm_layers > 1 else 0.0
        )

        bi_hidden = lstm_hidden * 2
        self.attention = AttentionPooling(bi_hidden)

        # Regularized regression MLP head
        self.head = nn.Sequential(
            nn.Linear(bi_hidden, 64),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.Dropout(dropout),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, 1)
        )

    def forward(self, x):
        # x shape: (batch, seq_len, input_dim)
        x_perm = x.permute(0, 2, 1)  # (batch, input_dim, seq_len)
        conv_out = self.conv(x_perm)  # (batch, conv_channels, seq_len)
        conv_out = conv_out.permute(0, 2, 1)  # (batch, seq_len, conv_channels)

        lstm_out, _ = self.lstm(conv_out)  # (batch, seq_len, 2 * lstm_hidden)
        context, _ = self.attention(lstm_out)  # (batch, 2 * lstm_hidden)
        out = self.head(context).squeeze(-1)  # (batch,)
        return out
