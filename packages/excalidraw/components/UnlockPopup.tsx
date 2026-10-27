import {
  getCommonBounds,
  getElementsInGroup,
  isFrameLikeElement,
  isNonDeletedElement,
  selectGroupsFromGivenElements,
} from "@excalidraw/element";
import { sceneCoordsToViewportCoords } from "@excalidraw/common";

import { flushSync } from "react-dom";

import type { NonDeletedExcalidrawElement } from "@excalidraw/element/types";

import { actionToggleElementLock } from "../actions";
import { t } from "../i18n";

import "./UnlockPopup.scss";

import { LockedIconFilled, MoveUnlockedIcon } from "./icons";

import type App from "./App";

import type { AppState } from "../types";

const UnlockPopup = ({
  app,
  activeLockedId,
}: {
  app: App;
  activeLockedId: NonNullable<AppState["activeLockedId"]>;
}) => {
  const candidateElement = app.scene.getElement(activeLockedId);
  // SAFETY: This should never happen, but log it just in case
  if (candidateElement && !isNonDeletedElement(candidateElement)) {
    console.error(
      "[NONDELETED][INVARIANT] UnlockPopup: activeLockedId points to a deleted element",
    );
  }
  const element: NonDeletedExcalidrawElement | null =
    candidateElement && isNonDeletedElement(candidateElement)
      ? candidateElement
      : null;

  const elements = element
    ? [element]
    : getElementsInGroup<NonDeletedExcalidrawElement>(
        app.scene.getNonDeletedElementsMap(),
        activeLockedId,
      );

  if (elements.length === 0) {
    return null;
  }

  const [x, y] = getCommonBounds(elements);
  const { x: viewX, y: viewY } = sceneCoordsToViewportCoords(
    { sceneX: x, sceneY: y },
    app.state,
  );

  // Check if target is a frame or child of a frame
  const frameCandidate = elements.find((el) => isFrameLikeElement(el));
  const parentFrameCandidate =
    !frameCandidate && elements[0]?.frameId
      ? app.scene.getElement(elements[0].frameId)
      : null;
  const frameElement = (frameCandidate ||
    (parentFrameCandidate && isFrameLikeElement(parentFrameCandidate)
      ? parentFrameCandidate
      : null)) as any;

  // When frameElement exists:
  // Mode 1 (Tam Kilit): frameElement.locked === true (soldaki buton aktif)
  // Mode 2 (Taşıma Serbest): frameElement.locked === false (sağdaki buton aktif)
  const isFrameLocked = frameElement ? frameElement.locked : true;

  // SOLDAKİ BUTON: Tam Kilit (Hem tuvale hem kendi içine tamamen kilitler)
  const handleFullLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (frameElement) {
      const nonDeleted = app.scene.getNonDeletedElements();
      const elementsToLock = [frameElement];
      for (const el of nonDeleted) {
        if (el.frameId === frameElement.id) {
          elementsToLock.push(el);
        }
      }
      for (const el of elementsToLock) {
        app.scene.mutateElement(el, { locked: true });
      }
      app.setState({
        selectedElementIds: {},
        activeLockedId: frameElement.id,
      });
    } else {
      flushSync(() => {
        const groupIds = selectGroupsFromGivenElements(elements, app.state);
        app.setState({
          selectedElementIds: elements.reduce(
            (acc, el) => ({
              ...acc,
              [el.id]: true,
            }),
            {},
          ),
          selectedGroupIds: groupIds,
          activeLockedId: null,
        });
      });
      app.actionManager.executeAction(actionToggleElementLock);
    }
  };

  // SAĞDAKİ BUTON: Taşıma Serbest (Container tuvalde serbestçe taşınabilir, içindekiler korunur)
  const handleMoveableMode = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!frameElement) return;

    const nonDeleted = app.scene.getNonDeletedElements();

    // 1. Unlock frame, card, header
    const elementsToUnlock = [frameElement];
    for (const el of nonDeleted) {
      if (
        el.frameId === frameElement.id &&
        ((el as any).customData?.isContainerHeader ||
          (el as any).customData?.isContainerCard)
      ) {
        elementsToUnlock.push(el);
      }
    }
    for (const el of elementsToUnlock) {
      app.scene.mutateElement(el, { locked: false });
    }

    // 2. Lock inner children so their contents/positions are protected
    for (const el of nonDeleted) {
      if (
        el.frameId === frameElement.id &&
        !(el as any).customData?.isContainerHeader &&
        !(el as any).customData?.isContainerCard
      ) {
        app.scene.mutateElement(el, { locked: true });
      }
    }

    // 3. Select the frame so the user can drag it immediately
    app.setState({
      selectedElementIds: { [frameElement.id]: true },
      activeLockedId: frameElement.id,
    });
  };

  return (
    <div
      className="UnlockPopup"
      style={{
        bottom: `${app.state.height + 12 - viewY + app.state.offsetTop}px`,
        left: `${viewX - app.state.offsetLeft}px`,
      }}
    >
      {/* SOLDAKİ: Tam Kilit (İşaretliyken hem tuvale hem kendi içinde tamamen kilitli) */}
      <button
        type="button"
        className={`UnlockPopup__button ${
          frameElement && isFrameLocked ? "UnlockPopup__button--active" : ""
        }`}
        onClick={handleFullLock}
        title={
          frameElement
            ? "Container Tam Kilitli (Hem tuvale hem kendi içine kilitli)"
            : t("labels.elementLock.unlock")
        }
      >
        {LockedIconFilled}
      </button>

      {/* SAĞDAKİ: Taşıma Serbest (İşaretliyken container tuvalde taşınabilir, içindekiler kilitli) */}
      {frameElement && (
        <button
          type="button"
          className={`UnlockPopup__button ${
            !isFrameLocked ? "UnlockPopup__button--active" : ""
          }`}
          onClick={handleMoveableMode}
          title="Container Taşıma Serbest (Tuvalde taşınabilir, içerik korunur)"
        >
          {MoveUnlockedIcon}
        </button>
      )}
    </div>
  );
};

export default UnlockPopup;
