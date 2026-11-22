import React, { useState } from 'react';
import {
  ArrowLeft,
  Bot,
  Check,
  Clock,
  Copy,
  Crown,
  Globe,
  Layers,
  Link as LinkIcon,
  Lock,
  Play,
  User,
  UserPlus,
  X,
} from 'lucide-react';
import { ALL_SEATS, SeatKey, getSeatTeam } from '../../shared/types';
import {
  getRoomMatchFormat,
  getTeamUniquePlayerCount,
  isTeamSoloPlayer,
} from '../../shared/seats';
import { getSeatLabel, useGame } from '../context/GameContext';
import { buildInviteUrl } from '../utils/routes';
import { TeamChat } from '../components/TeamChat';

export const RoomWaitingPage: React.FC = () => {
  const {
    room,
    mySeats,
    isHost,
    leaveRoom,
    takeSeat,
    vacateSeat,
    addBot,
    removeBot,
    startGame,
    sendChat,
  } = useGame();

  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  if (!room) return null;

  const filledCount = ALL_SEATS.filter((s) => room.seats[s] !== null).length;
  const openSeats = 4 - filledCount;
  const myTeam = mySeats.length > 0 ? getSeatTeam(mySeats[0]) : null;
  const isDualControl = mySeats.length === 2;
  const team1Solo = isTeamSoloPlayer(room.seats, 1);
  const team2Solo = isTeamSoloPlayer(room.seats, 2);
  const matchFormat = getRoomMatchFormat(room.seats);
  const team1Players = getTeamUniquePlayerCount(room.seats, 1);
  const team2Players = getTeamUniquePlayerCount(room.seats, 2);

  const copyCode = () => {
    navigator.clipboard?.writeText(room.code).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 1800);
  };

  const copyLink = () => {
    const url = buildInviteUrl(room.code);
    navigator.clipboard?.writeText(url).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 1800);
  };

  const renderSeatCard = (seat: SeatKey) => {
    const occupant = room.seats[seat];
    const isMine = mySeats.includes(seat);
    const isHostSeat = occupant && occupant.id === room.hostId;
    const isWhite = seat.endsWith('_w');
    const seatTeam = getSeatTeam(seat);
    const isMyOpenPartnerSeat = !occupant && myTeam === seatTeam;

    return (
      <div
        key={seat}
        className={`dh-seat-card ${occupant ? 'occupied' : 'open'} ${isMine ? 'mine' : ''}`}
      >
        <div className="dh-seat-top">
          <div className="dh-seat-title">
            <span className={`dh-color-swatch ${isWhite ? 'white' : 'black'}`} />
            <span>{getSeatLabel(seat)}</span>
          </div>
          {isHostSeat && (
            <span className="dh-tag tag-host">
              <Crown size={11} /> Host
            </span>
          )}
          {isMine && <span className="dh-tag tag-you">You</span>}
        </div>

        {occupant ? (
          <div className="dh-seat-occupant">
            <div className="dh-seat-name-row">
              {occupant.isBot ? <Bot size={16} /> : <User size={16} />}
              <strong>{occupant.name}</strong>
              {occupant.isBot && <span className="dh-tag tag-bot">AI Bot</span>}
            </div>
            {isHost && occupant.isBot && (
              <button
                type="button"
                className="dh-icon-btn dh-remove-bot-btn"
                onClick={() => removeBot(seat)}
                title="Remove bot from this seat"
              >
                <X size={15} />
              </button>
            )}
            {isMine && isDualControl && (
              <button
                type="button"
                className="dh-btn dh-btn-ghost dh-btn-sm dh-release-seat-btn"
                onClick={() => vacateSeat(seat)}
                title="Release this seat to go back to 1 board"
              >
                <X size={13} /> Release
              </button>
            )}
          </div>
        ) : (
          <div className="dh-seat-empty-actions">
            {isMyOpenPartnerSeat ? (
              <>
                <button
                  type="button"
                  className="dh-btn dh-btn-primary dh-btn-sm"
                  onClick={() => takeSeat(seat, true)}
                  title="Also take your partner’s seat to play both boards on this team (2v1 / 1v1)"
                >
                  <Layers size={14} /> Play Both
                </button>
                <button
                  type="button"
                  className="dh-btn dh-btn-secondary dh-btn-sm"
                  onClick={() => takeSeat(seat, false)}
                  title="Move to this seat and leave your current seat open"
                >
                  <UserPlus size={14} /> Move Here
                </button>
              </>
            ) : (
              <button
                type="button"
                className="dh-btn dh-btn-secondary dh-btn-sm"
                onClick={() => takeSeat(seat, false)}
              >
                <UserPlus size={14} /> Sit Here
              </button>
            )}
            {isHost && (
              <button type="button" className="dh-btn dh-btn-ghost dh-btn-sm" onClick={() => addBot(seat)}>
                <Bot size={14} /> + Bot
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <main className="dh-page dh-waiting-page">
      <div className="dh-waiting-topbar">
        <button type="button" className="dh-btn dh-btn-ghost dh-btn-sm" onClick={leaveRoom}>
          <ArrowLeft size={15} /> Leave Room
        </button>

        <div className="dh-waiting-meta">
          {matchFormat !== '2v2' && (
            <span className="dh-pill-badge emerald">
              <Layers size={12} /> {matchFormat} Mode
            </span>
          )}
          <span className="dh-pill-badge neutral">
            {room.visibility === 'private' ? <Lock size={12} /> : <Globe size={12} />}
            {room.visibility === 'private' ? 'Private Room' : 'Public Room'}
          </span>
          <span className="dh-pill-badge neutral">
            <Clock size={12} /> {room.timeControl.label}
          </span>
        </div>
      </div>

      <div className="dh-waiting-layout">
        <section className="dh-waiting-main dh-card">
          <div className="dh-waiting-title-block">
            <div>
              <h1>{room.name}</h1>
              <p>
                {openSeats === 0
                  ? `All 4 seats are filled (${matchFormat})! Ready to start the Duckhouse match.`
                  : `Waiting for ${openSeats} more seat${openSeats > 1 ? 's' : ''}. Share the code, click Play Both on your team for 2v1, or fill with Bots.`}
              </p>
            </div>

            <div className="dh-invite-box">
              <div className="dh-invite-code">
                <span className="dh-invite-label">ROOM CODE</span>
                <strong>{room.code}</strong>
              </div>
              <div className="dh-invite-actions">
                <button type="button" className="dh-btn dh-btn-secondary dh-btn-sm" onClick={copyCode}>
                  {copiedCode ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedCode ? 'Copied' : 'Code'}</span>
                </button>
                <button type="button" className="dh-btn dh-btn-secondary dh-btn-sm" onClick={copyLink}>
                  {copiedLink ? <Check size={14} /> : <LinkIcon size={14} />}
                  <span>{copiedLink ? 'Link Copied' : 'Invite Link'}</span>
                </button>
              </div>
            </div>
          </div>

          <div className="dh-teams-grid">
            <div className={`dh-team-column team-1 ${team1Solo ? 'solo-team' : ''}`}>
              <div className="dh-team-header">
                <div className="dh-team-header-row">
                  <h3>Team Emerald</h3>
                  {team1Solo && (
                    <span className="dh-tag tag-solo">
                      <Layers size={11} /> Both Boards
                    </span>
                  )}
                </div>
                <span>
                  {team1Solo
                    ? 'Solo player · Captures feed your other board'
                    : 'Partners · Captures feed each other'}
                </span>
              </div>
              {renderSeatCard('A_w')}
              {renderSeatCard('B_b')}
            </div>

            <div className={`dh-vs-divider ${matchFormat !== '2v2' ? 'has-format' : ''}`}>
              <span>VS</span>
              {matchFormat !== '2v2' && (
                <small>{team1Players > 0 && team2Players > 0 ? `${team1Players}v${team2Players}` : matchFormat}</small>
              )}
            </div>

            <div className={`dh-team-column team-2 ${team2Solo ? 'solo-team' : ''}`}>
              <div className="dh-team-header">
                <div className="dh-team-header-row">
                  <h3>Team Amber</h3>
                  {team2Solo && (
                    <span className="dh-tag tag-solo">
                      <Layers size={11} /> Both Boards
                    </span>
                  )}
                </div>
                <span>
                  {team2Solo
                    ? 'Solo player · Captures feed your other board'
                    : 'Partners · Captures feed each other'}
                </span>
              </div>
              {renderSeatCard('A_b')}
              {renderSeatCard('B_w')}
            </div>
          </div>

          <div className="dh-waiting-footer">
            {isHost ? (
              <>
                {openSeats > 0 && (
                  <button type="button" className="dh-btn dh-btn-secondary" onClick={() => addBot()}>
                    <Bot size={16} /> Fill {openSeats} Empty Seat{openSeats > 1 ? 's' : ''} with Bots
                  </button>
                )}
                <button
                  type="button"
                  className="dh-btn dh-btn-primary dh-btn-lg"
                  disabled={openSeats > 0}
                  onClick={() => startGame()}
                >
                  <Play size={18} />
                  <span>
                    {openSeats > 0
                      ? `Need ${openSeats} More Seat${openSeats > 1 ? 's' : ''} to Start`
                      : `Start ${matchFormat === '2v2' ? '' : `${matchFormat} `}Duckhouse Match`}
                  </span>
                </button>
              </>
            ) : (
              <div className="dh-waiting-guest-note">
                Waiting for host to start the match… Click any open seat to switch, or click Play Both on your team’s open seat for 2v1.
              </div>
            )}
          </div>
        </section>

        <aside className="dh-waiting-sidebar">
          <TeamChat messages={room.chat} mySeats={mySeats} isSoloTeam={isDualControl} onSend={sendChat} />
        </aside>
      </div>
    </main>
  );
};
