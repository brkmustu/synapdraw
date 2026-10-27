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

import { LockedIconFilled, MoveLockedIcon, MoveUnlockedIcon } from "./icons";

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

  const isFrameLocked = frameElement ? frameElement.locked : false;

  const handleUnlockOriginal = (e: React.MouseEvent) => {
    e.stopPropagation();
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
  };

  const handleToggleContainerMoveLock = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!frameElement) return;

    const nonDeleted = app.scene.getNonDeletedElements();
    const elementsToMutate = [frameElement];
    for (const el of nonDeleted) {
      if (
        el.frameId === frameElement.id &&
        ((el as any).customData?.isContainerHeader ||
          (el as any).customData?.isContainerCard)
      ) {
        elementsToMutate.push(el);
      }
    }

    if (isFrameLocked) {
      // Release container for moving, keep inner elements protected
      for (const el of elementsToMutate) {
        app.scene.mutateElement(el, { locked: false });
      }
      app.setState({
        selectedElementIds: { [frameElement.id]: true },
        activeLockedId: null,
      });
    } else {
      // Lock container in place
      for (const el of elementsToMutate) {
        app.scene.mutateElement(el, { locked: true });
      }
      app.setState({
        selectedElementIds: {},
        activeLockedId: frameElement.id,
      });
    }
  };

  return (
    <div
      className="UnlockPopup"
      style={{
        bottom: `${app.state.height + 12 - viewY + app.state.offsetTop}px`,
        left: `${viewX - app.state.offsetLeft}px`,
      }}
    >
      <button
        type="button"
        className="UnlockPopup__button"
        onClick={handleUnlockOriginal}
        title={t("labels.elementLock.unlock")}
      >
        {LockedIconFilled}
      </button>

      {frameElement && (
        <button
          type="button"
          className={`UnlockPopup__button ${
            isFrameLocked ? "UnlockPopup__button--locked" : "UnlockPopup__button--unlocked"
          }`}
          onClick={handleToggleContainerMoveLock}
          title={
            isFrameLocked
              ? "Container'ı Taşımak İçin Serbest Bırak (İçeriği Koru)"
              : "Container Konumunu Kilitle (Sabitle)"
          }
        >
          {isFrameLocked ? MoveLockedIcon : MoveUnlockedIcon}
        </button>
      )}
    </div>
  );
};

export default UnlockPopup;
